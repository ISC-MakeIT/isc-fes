package orders

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/services"
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

func (s *OrderService) GetOrderByID(ctx context.Context, orderID uuid.UUID) (orders.Order, error) {
	guestID, found, err := s.guestResolver.ResolveGuest(ctx)
	if err != nil {
		return orders.Order{}, fmt.Errorf("resolve order guest: %w", err)
	}
	if !found {
		return orders.Order{}, services.ErrNotFound
	}
	return s.repository.GetOrderByIDAndGuestID(ctx, orderID, guestID)
}
