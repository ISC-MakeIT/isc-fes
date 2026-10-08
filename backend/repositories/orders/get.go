package orders

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/repositories/db2entities"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/isc-makeit/isc-fes/backend/utils"
	"github.com/jackc/pgx/v5"
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
	if len(rows) == 0 {
		return []orders.Order{}, nil
	}
	orderIDs := utils.Map(rows, func(row sqlc.Order) uuid.UUID { return row.ID })
	items, err := r.queries.GetOrderItemsByOrderIDs(ctx, orderIDs)
	if err != nil {
		return nil, fmt.Errorf("get guest order items: %w", err)
	}
	toppings, err := r.queries.GetOrderItemToppingsByOrderIDs(ctx, orderIDs)
	if err != nil {
		return nil, fmt.Errorf("get guest order toppings: %w", err)
	}
	return db2entities.ToOrders(rows, items, toppings), nil
}

func (r *OrderRepository) GetOrderByIDAndGuestID(ctx context.Context, orderID, guestID uuid.UUID) (orders.Order, error) {
	row, err := r.queries.GetOrderByIDAndGuestID(ctx, sqlc.GetOrderByIDAndGuestIDParams{
		OrderID: orderID, GuestID: guestID,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return orders.Order{}, services.ErrNotFound
	}
	if err != nil {
		return orders.Order{}, fmt.Errorf("get guest order: %w", err)
	}
	order, err := loadSnapshot(ctx, r.queries, row)
	if err != nil {
		return orders.Order{}, fmt.Errorf("get guest order snapshot: %w", err)
	}
	return order, nil
}
