package orders

import (
	"context"
	"fmt"

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
