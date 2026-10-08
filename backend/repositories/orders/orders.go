package orders

import (
	"context"
	"errors"
	"fmt"
	"math"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	domain "github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/repositories/db2entities"
	"github.com/isc-makeit/isc-fes/backend/services"
	orderservice "github.com/isc-makeit/isc-fes/backend/services/orders"
	"github.com/isc-makeit/isc-fes/backend/utils"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type OrderRepository struct {
	queries *sqlc.Queries
	pool    *pgxpool.Pool
}

func NewOrderRepository(queries *sqlc.Queries, pool *pgxpool.Pool) *OrderRepository {
	return &OrderRepository{queries: queries, pool: pool}
}

var _ orderservice.Repository = (*OrderRepository)(nil)

func (r *OrderRepository) CreateOrder(ctx context.Context, input orderservice.CreateRepositoryInput) (orderservice.CreateResult, error) {
	tx, err := r.pool.BeginTx(ctx, pgx.TxOptions{IsoLevel: pgx.ReadCommitted})
	if err != nil {
		return orderservice.CreateResult{}, fmt.Errorf("begin order transaction: %w", err)
	}
	defer tx.Rollback(ctx)
	qtx := r.queries.WithTx(tx)

	// 全経路で Guest → Store → Membership → Cart → Counter の順序を守る。
	if _, err := qtx.LockGuest(ctx, input.GuestID); err != nil {
		return orderservice.CreateResult{}, fmt.Errorf("lock order guest: %w", err)
	}
	saved, err := qtx.FindOrderForCartVersion(ctx, sqlc.FindOrderForCartVersionParams{
		GuestID: input.GuestID, StoreID: input.StoreID, CartVersion: input.ExpectedCartVersion,
	})
	if err == nil {
		order, err := loadSnapshot(ctx, qtx, saved)
		if err != nil {
			return orderservice.CreateResult{}, err
		}
		if err := tx.Commit(ctx); err != nil {
			return orderservice.CreateResult{}, err
		}
		return orderservice.CreateResult{Order: order, Replayed: true}, nil
	}
	if !errors.Is(err, pgx.ErrNoRows) {
		return orderservice.CreateResult{}, err
	}

	store, err := qtx.LockStoreForShare(ctx, input.StoreID)
	if errors.Is(err, pgx.ErrNoRows) {
		return orderservice.CreateResult{}, services.ErrNotFound
	}
	if err != nil {
		return orderservice.CreateResult{}, err
	}
	if store.ReviewStatus != sqlc.StoreReviewStatusApproved {
		return orderservice.CreateResult{}, services.ErrNotFound
	}
	if store.ClosedAt.Valid {
		return orderservice.CreateResult{}, orderservice.ErrStoreClosed
	}

	var exemptAccountID *uuid.UUID
	if input.AccountID != nil {
		membership, err := qtx.LockOrderMembership(ctx, sqlc.LockOrderMembershipParams{
			StoreID: input.StoreID, AccountID: *input.AccountID,
		})
		if err != nil && !errors.Is(err, pgx.ErrNoRows) {
			return orderservice.CreateResult{}, err
		}
		if err == nil && domain.CanExemptOrderLimit(input.StoreID, entities.StoreMembership{
			StoreID: membership.StoreID, AccountID: membership.AccountID,
			Role: entities.StoreMemberRole(membership.Role), JoinedAt: membership.JoinedAt.Time,
		}) {
			exemptAccountID = input.AccountID
		}
	}

	cart, err := qtx.LockOrderCart(ctx, sqlc.LockOrderCartParams{GuestID: input.GuestID, StoreID: input.StoreID})
	if errors.Is(err, pgx.ErrNoRows) {
		return orderservice.CreateResult{}, services.ErrInvalidInput
	}
	if err != nil {
		return orderservice.CreateResult{}, err
	}
	if cart.Version != input.ExpectedCartVersion || cart.Version == math.MaxInt32 {
		return orderservice.CreateResult{}, orderservice.ErrCartVersionConflict
	}
	rows, err := qtx.GetCartByGuestIDAndStoreID(ctx, sqlc.GetCartByGuestIDAndStoreIDParams{
		GuestID: input.GuestID, StoreID: input.StoreID,
	})
	if err != nil {
		return orderservice.CreateResult{}, err
	}
	items, total, err := orderservice.PrepareItems(db2entities.ToCart(rows))
	if err != nil {
		return orderservice.CreateResult{}, err
	}

	if exemptAccountID == nil {
		count, err := qtx.CountActiveNonExemptOrders(ctx, input.GuestID)
		if err != nil {
			return orderservice.CreateResult{}, err
		}
		if domain.IsOrderLimitReached(count) {
			return orderservice.CreateResult{}, orderservice.ErrOrderLimitReached
		}
	}
	number, err := qtx.NextOrderDisplayNumber(ctx, input.StoreID)
	if err != nil {
		return orderservice.CreateResult{}, err
	}
	saved, err = qtx.CreateOrder(ctx, sqlc.CreateOrderParams{
		StoreID: store.ID, GuestID: input.GuestID, TotalAmount: total, DisplayNumber: number,
		OriginCartID: cart.ID, OriginCartVersion: cart.Version, LimitExemptedByAccountID: exemptAccountID,
		StoreName: store.Name, RoomName: store.Room,
	})
	if err != nil {
		return orderservice.CreateResult{}, err
	}
	if err := saveItems(ctx, qtx, saved.ID, items); err != nil {
		return orderservice.CreateResult{}, err
	}
	if err := qtx.DeleteCartItemsNotIn(ctx, sqlc.DeleteCartItemsNotInParams{
		CartID: cart.ID, RemainingItemIds: []uuid.UUID{},
	}); err != nil {
		return orderservice.CreateResult{}, err
	}
	if _, err := qtx.BumpCartVersion(ctx, sqlc.BumpCartVersionParams{
		GuestID: input.GuestID, StoreID: input.StoreID, ExpectedVersion: cart.Version,
	}); err != nil {
		return orderservice.CreateResult{}, err
	}
	order, err := loadSnapshot(ctx, qtx, saved)
	if err != nil {
		return orderservice.CreateResult{}, err
	}
	if err := tx.Commit(ctx); err != nil {
		return orderservice.CreateResult{}, err
	}
	return orderservice.CreateResult{Order: order}, nil
}

func saveItems(ctx context.Context, qtx *sqlc.Queries, orderID uuid.UUID, items []domain.OrderItem) error {
	for _, item := range items {
		saved, err := qtx.CreateOrderItem(ctx, sqlc.CreateOrderItemParams{
			OrderID: orderID, StoreID: item.StoreID, MenuID: item.MenuID, MenuName: item.MenuName,
			UnitPrice: item.UnitPrice, Quantity: item.Quantity,
		})
		if err != nil {
			return err
		}
		for _, topping := range item.Toppings {
			if err := qtx.CreateOrderItemTopping(ctx, sqlc.CreateOrderItemToppingParams{
				OrderItemID: saved.ID, StoreID: item.StoreID, ToppingID: topping.ToppingID,
				ToppingName: topping.ToppingName, UnitPrice: topping.UnitPrice,
			}); err != nil {
				return err
			}
		}
	}
	return nil
}

// 初回と再送で同じ保存済みsnapshotから応答を作る。商品テーブルを参照しない。
func loadSnapshot(ctx context.Context, qtx *sqlc.Queries, row sqlc.Order) (domain.Order, error) {
	items, err := qtx.GetCreatedOrderItems(ctx, row.ID)
	if err != nil {
		return domain.Order{}, err
	}
	toppings, err := qtx.GetCreatedOrderItemToppings(ctx, row.ID)
	if err != nil {
		return domain.Order{}, err
	}
	byItem := make(map[uuid.UUID][]domain.OrderItemTopping)
	for _, topping := range toppings {
		byItem[topping.OrderItemID] = append(byItem[topping.OrderItemID], domain.OrderItemTopping{
			OrderItemID: topping.OrderItemID, StoreID: topping.StoreID, ToppingID: topping.ToppingID,
			ToppingName: topping.ToppingName, UnitPrice: topping.UnitPrice,
		})
	}
	order := domain.Order{
		ID: row.ID, StoreID: row.StoreID, GuestID: row.GuestID, Status: domain.OrderStatus(row.Status),
		TotalAmount: row.TotalAmount, DisplayNumber: row.DisplayNumber, Version: row.Version,
		OriginCartID: row.OriginCartID, OriginCartVersion: row.OriginCartVersion,
		LimitExemptedByAccountID: row.LimitExemptedByAccountID, StoreName: row.StoreName, RoomName: row.RoomName,
		ReadyAt: utils.TimestamptzToTimePtr(row.ReadyAt), CompletedAt: utils.TimestamptzToTimePtr(row.CompletedAt),
		CancelledAt: utils.TimestamptzToTimePtr(row.CancelledAt), CreatedAt: row.CreatedAt.Time, UpdatedAt: row.UpdatedAt.Time,
		Items: make([]domain.OrderItem, 0, len(items)),
	}
	for _, item := range items {
		selected := byItem[item.ID]
		if selected == nil {
			selected = []domain.OrderItemTopping{}
		}
		order.Items = append(order.Items, domain.OrderItem{
			ID: item.ID, OrderID: item.OrderID, StoreID: item.StoreID, MenuID: item.MenuID, MenuName: item.MenuName,
			UnitPrice: item.UnitPrice, Quantity: item.Quantity, Toppings: selected,
		})
	}
	return order, nil
}
