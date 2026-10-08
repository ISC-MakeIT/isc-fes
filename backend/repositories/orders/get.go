package orders

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/repositories/db2entities"
	"github.com/isc-makeit/isc-fes/backend/utils"
)

func (r *OrderRepository) GetOrdersByGuestID(ctx context.Context, guestID uuid.UUID, statuses []orders.OrderStatus) ([]orders.Order, error) {
	rows, err := r.queries.GetOrdersByGuestID(ctx, sqlc.GetOrdersByGuestIDParams{
		GuestID: guestID,
		Statuses: utils.Map(statuses, func(status orders.OrderStatus) string {
			return string(status)
		}),
	})
	if err != nil {
		return nil, fmt.Errorf("get guest orders: %w", err)
	}
	return r.loadSnapshots(ctx, rows)
}

func (r *OrderRepository) GetOrdersByStoreID(ctx context.Context, storeID uuid.UUID, statuses []orders.OrderStatus) ([]orders.Order, error) {
	rows, err := r.queries.GetOrdersByStoreID(ctx, sqlc.GetOrdersByStoreIDParams{
		StoreID: storeID,
		Statuses: utils.Map(statuses, func(status orders.OrderStatus) string {
			return string(status)
		}),
	})
	if err != nil {
		return nil, fmt.Errorf("get store orders: %w", err)
	}
	return r.loadSnapshots(ctx, rows)
}

func (r *OrderRepository) loadSnapshots(ctx context.Context, rows []sqlc.Order) ([]orders.Order, error) {
	if len(rows) == 0 {
		return []orders.Order{}, nil
	}
	orderIDs := utils.Map(rows, func(row sqlc.Order) uuid.UUID { return row.ID })
	items, err := r.queries.GetOrderItemsByOrderIDs(ctx, orderIDs)
	if err != nil {
		return nil, fmt.Errorf("get order items: %w", err)
	}
	toppings, err := r.queries.GetOrderItemToppingsByOrderIDs(ctx, orderIDs)
	if err != nil {
		return nil, fmt.Errorf("get order toppings: %w", err)
	}
	return db2entities.ToOrders(rows, items, toppings), nil
}
