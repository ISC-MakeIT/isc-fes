package orders

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	domain "github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/repositories/db2entities"
	"github.com/isc-makeit/isc-fes/backend/services"
	orderservice "github.com/isc-makeit/isc-fes/backend/services/orders"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func (r *OrderRepository) UpdateOrder(ctx context.Context, input orderservice.UpdateRepositoryInput) (domain.Order, error) {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return domain.Order{}, fmt.Errorf("begin order update transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	qtx := r.queries.WithTx(tx)

	// Store → Membership → Orderの順でロックする。Guest/Cart/Counterは変更しない。
	// Storeの共有ロックはMembership変更・削除の排他ロックと競合する。
	// 閉店や販売状況は既存の注文の状態更新を妨げない。
	if _, err := qtx.LockStoreForShare(ctx, input.StoreID); errors.Is(err, pgx.ErrNoRows) {
		return domain.Order{}, services.ErrNotFound
	} else if err != nil {
		return domain.Order{}, fmt.Errorf("lock order update store: %w", err)
	}
	membership, err := qtx.LockOrderMembership(ctx, sqlc.LockOrderMembershipParams{
		StoreID: input.StoreID, AccountID: input.AccountID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Order{}, services.ErrForbidden
	}
	if err != nil {
		return domain.Order{}, fmt.Errorf("lock order update membership: %w", err)
	}
	if !domain.CanUpdateStoreOrders(input.StoreID, entities.StoreMembership{
		StoreID: membership.StoreID, AccountID: membership.AccountID, Role: entities.StoreMemberRole(membership.Role),
	}) {
		return domain.Order{}, services.ErrForbidden
	}
	row, err := qtx.LockOrderByIDAndStoreID(ctx, sqlc.LockOrderByIDAndStoreIDParams{
		OrderID: input.OrderID, StoreID: input.StoreID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return domain.Order{}, services.ErrNotFound
	}
	if err != nil {
		return domain.Order{}, fmt.Errorf("lock order update order: %w", err)
	}
	at, err := qtx.GetOrderUpdateTime(ctx)
	if err != nil {
		return domain.Order{}, fmt.Errorf("get order update time: %w", err)
	}
	current := db2entities.ToOrders([]sqlc.Order{row}, nil, nil)[0]
	updated, err := orderservice.PrepareUpdate(current, input.Status, input.ExpectedVersion, at.Time)
	if err != nil {
		return domain.Order{}, err
	}
	if updated.Status != current.Status {
		row, err = qtx.UpdateOrderStatus(ctx, sqlc.UpdateOrderStatusParams{
			OrderID: input.OrderID, StoreID: input.StoreID, ExpectedVersion: input.ExpectedVersion,
			Status: sqlc.OrderStatus(updated.Status), UpdatedAt: timestamp(&updated.UpdatedAt),
			ReadyAt: timestamp(updated.ReadyAt), CompletedAt: timestamp(updated.CompletedAt), CancelledAt: timestamp(updated.CancelledAt),
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return domain.Order{}, orderservice.ErrOrderVersionConflict
		}
		if err != nil {
			return domain.Order{}, fmt.Errorf("update order status: %w", err)
		}
	}
	order, err := loadSnapshot(ctx, qtx, row)
	if err != nil {
		return domain.Order{}, fmt.Errorf("load updated order: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return domain.Order{}, fmt.Errorf("commit order update: %w", err)
	}
	return order, nil
}

func timestamp(at *time.Time) pgtype.Timestamptz {
	if at == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: *at, Valid: true}
}
