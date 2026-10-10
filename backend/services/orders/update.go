package orders

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/services"
)

var (
	ErrOrderVersionConflict = fmt.Errorf("order version conflict: %w", services.ErrConflict)
	ErrOrderStateConflict   = fmt.Errorf("order state conflict: %w", services.ErrConflict)
	ErrCancelTooEarly       = fmt.Errorf("order cancellation too early: %w", services.ErrConflict)
)

type UpdateInput struct {
	StoreID         uuid.UUID
	OrderID         uuid.UUID
	Status          orders.OrderStatus
	ExpectedVersion int32
}

type UpdateRepositoryInput struct {
	UpdateInput
	AccountID uuid.UUID
}

func (s *OrderService) UpdateOrder(ctx context.Context, input UpdateInput) (orders.Order, error) {
	account, err := services.RequireAuthenticatedAccount(ctx)
	if err != nil {
		return orders.Order{}, err
	}
	if input.StoreID == uuid.Nil || input.OrderID == uuid.Nil || !input.Status.IsValid() || input.ExpectedVersion <= 0 {
		return orders.Order{}, services.ErrInvalidInput
	}
	// Membershipは削除・変更との競合を防ぐため、Repositoryの取引内で確認する。
	return s.repository.UpdateOrder(ctx, UpdateRepositoryInput{UpdateInput: input, AccountID: account.ID})
}

// PrepareUpdate はロックした最新の注文に対して再送・競合・状態遷移を判定する。
func PrepareUpdate(order orders.Order, status orders.OrderStatus, expectedVersion int32, at time.Time) (orders.Order, error) {
	if !status.IsValid() || expectedVersion <= 0 {
		return orders.Order{}, services.ErrInvalidInput
	}
	if order.Status != status && order.Version != expectedVersion {
		return orders.Order{}, ErrOrderVersionConflict
	}
	updated, err := order.Transition(status, at)
	switch {
	case errors.Is(err, orders.ErrCancelTooEarly):
		return orders.Order{}, ErrCancelTooEarly
	case errors.Is(err, orders.ErrStateConflict), errors.Is(err, orders.ErrVersionOutOfRange):
		return orders.Order{}, ErrOrderStateConflict
	case err != nil:
		return orders.Order{}, fmt.Errorf("transition order: %w", err)
	}
	return updated, nil
}
