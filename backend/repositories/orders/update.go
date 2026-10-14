package orders

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	domainactivity "github.com/isc-makeit/isc-fes/backend/domains/activity"
	domain "github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/repositories/activity"
	"github.com/isc-makeit/isc-fes/backend/repositories/db2entities"
	"github.com/isc-makeit/isc-fes/backend/services"
	orderservice "github.com/isc-makeit/isc-fes/backend/services/orders"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgtype"
)

func (r *OrderRepository) UpdateOrder(ctx context.Context, input orderservice.UpdateRepositoryInput) (orderservice.UpdateResult, error) {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return orderservice.UpdateResult{}, fmt.Errorf("begin order update transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	qtx := r.queries.WithTx(tx)

	// Store → Account → Membership → Orderの順でロックする。Guest/Cart/Counterは変更しない。
	// Storeの共有ロックはMembership変更・削除の排他ロックと競合する。
	// 閉店や販売状況は既存の注文の状態更新を妨げない。
	if _, err := qtx.LockStoreForShare(ctx, input.StoreID); errors.Is(err, pgx.ErrNoRows) {
		return orderservice.UpdateResult{}, services.ErrNotFound
	} else if err != nil {
		return orderservice.UpdateResult{}, fmt.Errorf("lock order update store: %w", err)
	}
	membership, err := authorizedMembership(ctx, qtx, input.AccountID, input.StoreID, true)
	if errors.Is(err, pgx.ErrNoRows) {
		return orderservice.UpdateResult{}, services.ErrForbidden
	}
	if err != nil {
		return orderservice.UpdateResult{}, fmt.Errorf("lock order update membership: %w", err)
	}
	if !domain.CanUpdateStoreOrders(input.StoreID, membership) {
		return orderservice.UpdateResult{}, services.ErrForbidden
	}
	row, err := qtx.LockOrderByIDAndStoreID(ctx, sqlc.LockOrderByIDAndStoreIDParams{
		OrderID: input.OrderID, StoreID: input.StoreID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return orderservice.UpdateResult{}, services.ErrNotFound
	}
	if err != nil {
		return orderservice.UpdateResult{}, fmt.Errorf("lock order update order: %w", err)
	}
	at, err := qtx.GetOrderUpdateTime(ctx)
	if err != nil {
		return orderservice.UpdateResult{}, fmt.Errorf("get order update time: %w", err)
	}
	current := db2entities.ToOrders([]sqlc.Order{row}, nil, nil)[0]
	updated, err := orderservice.PrepareUpdate(current, input.Status, input.ExpectedVersion, at.Time)
	if err != nil {
		return orderservice.UpdateResult{}, err
	}
	changed := updated.Status != current.Status
	if changed {
		row, err = qtx.UpdateOrderStatus(ctx, sqlc.UpdateOrderStatusParams{
			OrderID: input.OrderID, StoreID: input.StoreID, ExpectedVersion: input.ExpectedVersion,
			Status: sqlc.OrderStatus(updated.Status), UpdatedAt: timestamp(&updated.UpdatedAt),
			ReadyAt: timestamp(updated.ReadyAt), CompletedAt: timestamp(updated.CompletedAt), CancelledAt: timestamp(updated.CancelledAt),
		})
		if errors.Is(err, pgx.ErrNoRows) {
			return orderservice.UpdateResult{}, orderservice.ErrOrderVersionConflict
		}
		if err != nil {
			return orderservice.UpdateResult{}, fmt.Errorf("update order status: %w", err)
		}
		if err := activity.Record(ctx, qtx, domainactivity.Event{
			Type: domainactivity.OrderStatusChanged, StoreID: row.StoreID, SubjectID: row.ID,
			Actor: domainactivity.AccountActor(input.AccountID), At: updated.UpdatedAt,
			Payload: domainactivity.Payload{
				Before:  domainactivity.Snapshot{"status": current.Status},
				After:   domainactivity.Snapshot{"status": updated.Status},
				Context: map[string]any{"version": row.Version},
			},
		}); err != nil {
			return orderservice.UpdateResult{}, err
		}
	}
	order, err := loadSnapshot(ctx, qtx, row)
	if err != nil {
		return orderservice.UpdateResult{}, fmt.Errorf("load updated order: %w", err)
	}
	if err := tx.Commit(ctx); err != nil {
		return orderservice.UpdateResult{}, fmt.Errorf("commit order update: %w", err)
	}
	return orderservice.UpdateResult{Order: order, Changed: changed}, nil
}

func timestamp(at *time.Time) pgtype.Timestamptz {
	if at == nil {
		return pgtype.Timestamptz{}
	}
	return pgtype.Timestamptz{Time: *at, Valid: true}
}
