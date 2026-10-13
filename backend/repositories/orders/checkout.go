package orders

import (
	"context"
	"errors"
	"math"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	domain "github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/repositories/db2entities"
	"github.com/isc-makeit/isc-fes/backend/services"
	orderservice "github.com/isc-makeit/isc-fes/backend/services/orders"
	"github.com/jackc/pgx/v5"
)

func (r *OrderRepository) CheckCheckout(ctx context.Context, input orderservice.CreateRepositoryInput) error {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.RepeatableRead, AccessMode: pgx.ReadOnly})
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)
	if _, err := prepareCheckout(ctx, r.queries.WithTx(tx), input, false); err != nil {
		return err
	}
	return tx.Commit(ctx)
}

type checkoutPreparation struct {
	store           sqlc.Store
	cart            sqlc.Cart
	items           []domain.OrderItem
	total           int64
	exemptAccountID *uuid.UUID
}

// prepareCheckoutはGETの事前チェックとPOSTの新規注文で同じ条件・順序を適用する。
// POSTではGuestロックと再送の解決後に呼び、Store → Membership → Cartの順にロックする。
// GETは同じ読み取りsnapshot内で呼び、ロックも書き込みも行わない。
func prepareCheckout(ctx context.Context, q *sqlc.Queries, input orderservice.CreateRepositoryInput, lockRows bool) (checkoutPreparation, error) {
	var result checkoutPreparation
	var err error
	if lockRows {
		result.store, err = q.LockStoreForShare(ctx, input.StoreID)
	} else {
		result.store, err = q.GetStoreByID(ctx, input.StoreID)
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return result, services.ErrNotFound
	}
	if err != nil {
		return result, err
	}
	if result.store.ReviewStatus != sqlc.StoreReviewStatusApproved {
		return result, services.ErrNotFound
	}
	if result.store.ClosedAt.Valid {
		return result, orderservice.ErrStoreClosed
	}
	if !result.store.OrderEnabled {
		return result, orderservice.ErrStoreOrderDisabled
	}

	if input.AccountID != nil {
		var membership sqlc.StoreMember
		if lockRows {
			membership, err = q.LockOrderMembership(ctx, sqlc.LockOrderMembershipParams{
				StoreID: input.StoreID, AccountID: *input.AccountID,
			})
		} else {
			membership, err = q.GetStoreMembershipByAccountIDAndStoreID(ctx, sqlc.GetStoreMembershipByAccountIDAndStoreIDParams{
				StoreID: input.StoreID, AccountID: *input.AccountID,
			})
		}
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return result, err
		}
		if err == nil && domain.CanExemptOrderLimit(input.StoreID, entities.StoreMembership{
			StoreID: membership.StoreID, AccountID: membership.AccountID,
			Role: entities.StoreMemberRole(membership.Role), JoinedAt: membership.JoinedAt.Time,
		}) {
			result.exemptAccountID = input.AccountID
		}
	}

	if lockRows {
		result.cart, err = q.LockOrderCart(ctx, sqlc.LockOrderCartParams{GuestID: input.GuestID, StoreID: input.StoreID})
	} else {
		result.cart, err = q.GetOrderCart(ctx, sqlc.GetOrderCartParams{GuestID: input.GuestID, StoreID: input.StoreID})
	}
	if errors.Is(err, pgx.ErrNoRows) {
		return result, orderservice.ErrCartEmpty
	}
	if err != nil {
		return result, err
	}
	if result.cart.Version != input.ExpectedCartVersion || result.cart.Version == math.MaxInt32 {
		return result, orderservice.ErrCartVersionConflict
	}
	rows, err := q.GetCartByGuestIDAndStoreID(ctx, sqlc.GetCartByGuestIDAndStoreIDParams{
		GuestID: input.GuestID, StoreID: input.StoreID,
	})
	if err != nil {
		return result, err
	}
	result.items, result.total, err = orderservice.PrepareItems(db2entities.ToCart(rows))
	if err != nil {
		return result, err
	}

	if result.exemptAccountID == nil {
		count, err := q.CountActiveNonExemptOrders(ctx, input.GuestID)
		if err != nil {
			return result, err
		}
		if domain.IsOrderLimitReached(count) {
			return result, orderservice.ErrOrderLimitReached
		}
	}
	return result, nil
}
