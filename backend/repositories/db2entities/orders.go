package db2entities

import (
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/utils"
)

// ToOrders は保存済みの注文と明細を結合する。注文行の並び順を維持し、現在の商品情報は参照しない。
func ToOrders(rows []sqlc.Order, items []sqlc.OrderItem, toppings []sqlc.OrderItemTopping) []orders.Order {
	result := make([]orders.Order, 0, len(rows))
	orderIndex := make(map[uuid.UUID]int, len(rows))
	for _, row := range rows {
		orderIndex[row.ID] = len(result)
		result = append(result, orders.Order{
			ID: row.ID, StoreID: row.StoreID, GuestID: row.GuestID, Status: orders.OrderStatus(row.Status),
			TotalAmount: row.TotalAmount, DisplayNumber: row.DisplayNumber, Version: row.Version,
			OriginCartID: row.OriginCartID, OriginCartVersion: row.OriginCartVersion,
			LimitExemptedByAccountID: row.LimitExemptedByAccountID, StoreName: row.StoreName, RoomName: row.RoomName,
			ReadyAt: utils.TimestamptzToTimePtr(row.ReadyAt), CompletedAt: utils.TimestamptzToTimePtr(row.CompletedAt),
			CancelledAt: utils.TimestamptzToTimePtr(row.CancelledAt), CreatedAt: row.CreatedAt.Time, UpdatedAt: row.UpdatedAt.Time,
			Items: []orders.OrderItem{},
		})
	}
	type itemLocation struct {
		order int
		item  int
	}
	itemIndex := make(map[uuid.UUID]itemLocation, len(items))
	for _, item := range items {
		index, exists := orderIndex[item.OrderID]
		if !exists {
			continue
		}
		order := &result[index]
		itemIndex[item.ID] = itemLocation{order: index, item: len(order.Items)}
		order.Items = append(order.Items, orders.OrderItem{
			ID: item.ID, OrderID: item.OrderID, StoreID: item.StoreID, MenuID: item.MenuID, MenuName: item.MenuName,
			UnitPrice: item.UnitPrice, Quantity: item.Quantity, Toppings: []orders.OrderItemTopping{},
		})
	}
	for _, topping := range toppings {
		index, exists := itemIndex[topping.OrderItemID]
		if !exists {
			continue
		}
		item := &result[index.order].Items[index.item]
		item.Toppings = append(item.Toppings, orders.OrderItemTopping{
			OrderItemID: topping.OrderItemID, StoreID: topping.StoreID, ToppingID: topping.ToppingID,
			ToppingName: topping.ToppingName, UnitPrice: topping.UnitPrice,
		})
	}
	return result
}
