package orders

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/jackc/pgx/v5"
)

func (s *OrderService) GetOrders(ctx context.Context, statuses []orders.OrderStatus) ([]orders.Order, error) {
	for _, status := range statuses {
		if !status.IsValid() {
			return nil, services.ErrInvalidInput
		}
	}
	guestID, found, err := s.guestResolver.ResolveGuest(ctx)
	if err != nil {
		return nil, fmt.Errorf("resolve order guest: %w", err)
	}
	if !found {
		return []orders.Order{}, nil
	}
	return s.repository.GetOrdersByGuestID(ctx, guestID, statuses)
}

func (s *OrderService) GetOrdersByStoreID(ctx context.Context, storeID uuid.UUID, statuses []orders.OrderStatus) ([]orders.Order, error) {
	account, err := services.RequireAuthenticatedAccount(ctx)
	if err != nil {
		return nil, err
	}
	for _, status := range statuses {
		if !status.IsValid() {
			return nil, services.ErrInvalidInput
		}
	}
	if _, err := s.storeRepository.GetStoreByID(ctx, storeID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, services.ErrNotFound
		}
		return nil, fmt.Errorf("get order store: %w", err)
	}
	membership, err := s.storeMembershipRepository.GetStoreMembershipByAccountIDAndStoreID(ctx, account.ID, storeID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, services.ErrForbidden
	}
	if err != nil {
		return nil, fmt.Errorf("get order store membership: %w", err)
	}
	if !orders.CanViewStoreOrders(storeID, membership) {
		return nil, services.ErrForbidden
	}
	if len(statuses) == 0 {
		statuses = []orders.OrderStatus{orders.OrderStatusPending, orders.OrderStatusReady}
	}
	return s.repository.GetOrdersByStoreID(ctx, storeID, statuses)
}
