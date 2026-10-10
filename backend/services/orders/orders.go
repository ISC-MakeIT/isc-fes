package orders

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/carts"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/services"
)

var (
	ErrCartVersionConflict = fmt.Errorf("cart version conflict: %w", services.ErrConflict)
	ErrUnavailableItems    = fmt.Errorf("cart contains unavailable selections: %w", services.ErrConflict)
	ErrOrderLimitReached   = fmt.Errorf("active order limit reached: %w", services.ErrConflict)
	ErrStoreClosed         = fmt.Errorf("store is closed: %w", services.ErrConflict)
)

type CreateInput struct {
	StoreID             uuid.UUID
	ExpectedCartVersion int32
}

type CreateRepositoryInput struct {
	CreateInput
	GuestID   uuid.UUID
	AccountID *uuid.UUID
}

type CreateResult struct {
	Order    orders.Order
	Replayed bool
}

// 注文の作成・取得・店舗による状態更新に必要な操作を要求する。
type Repository interface {
	CreateOrder(context.Context, CreateRepositoryInput) (CreateResult, error)
	UpdateOrder(context.Context, UpdateRepositoryInput) (orders.Order, error)
	GetOrdersByGuestID(context.Context, uuid.UUID, []orders.OrderStatus) ([]orders.Order, error)
	GetOrdersByStoreID(context.Context, uuid.UUID, []orders.OrderStatus) ([]orders.Order, error)
	GetOrderByIDAndGuestID(ctx context.Context, orderID, guestID uuid.UUID) (orders.Order, error)
}

type StoreRepository interface {
	GetStoreByID(context.Context, uuid.UUID) (entities.Store, error)
}

type CurrentAccountLoader interface {
	GetCurrentAccount(context.Context) (entities.Account, error)
}

type GuestResolver interface {
	ResolveGuest(context.Context) (guestID uuid.UUID, found bool, err error)
}

type OrderService struct {
	repository                Repository
	accountLoader             CurrentAccountLoader
	guestResolver             GuestResolver
	storeRepository           StoreRepository
	storeMembershipRepository services.StoreMembershipRepository
}

func NewOrderService(
	repository Repository,
	accountLoader CurrentAccountLoader,
	guestResolver GuestResolver,
	storeRepository StoreRepository,
	storeMembershipRepository services.StoreMembershipRepository,
) *OrderService {
	return &OrderService{
		repository: repository, accountLoader: accountLoader, guestResolver: guestResolver,
		storeRepository: storeRepository, storeMembershipRepository: storeMembershipRepository,
	}
}

func (s *OrderService) CreateOrder(ctx context.Context, input CreateInput) (CreateResult, error) {
	if input.StoreID == uuid.Nil || input.ExpectedCartVersion <= 0 {
		return CreateResult{}, services.ErrInvalidInput
	}
	guestID, err := services.RequireGuest(ctx)
	if err != nil {
		return CreateResult{}, err
	}
	// Accountは任意。IDは検証済みセッションからのみ取得し、免除の判定は取引内で行う。
	account, err := s.accountLoader.GetCurrentAccount(ctx)
	if err != nil && !errors.Is(err, services.ErrUnauthenticated) {
		return CreateResult{}, fmt.Errorf("resolve order account: %w", err)
	}
	repoInput := CreateRepositoryInput{CreateInput: input, GuestID: guestID}
	if err == nil && account.ID != uuid.Nil {
		repoInput.AccountID = &account.ID
	}
	return s.repository.CreateOrder(ctx, repoInput)
}

// PrepareItemsはStore・Cartロック中に取得した最新カートを検証する。
// 利用不可の選択を除外せず、全体を拒否する。金額は注文ドメインに委ねる。
func PrepareItems(cart carts.Cart) ([]orders.OrderItem, int64, error) {
	items := make([]orders.OrderItem, 0, len(cart.Items))
	for _, item := range cart.Items {
		if item.Soldout || item.DeletedAt != nil {
			return nil, 0, ErrUnavailableItems
		}
		snapshot := orders.OrderItem{StoreID: item.StoreID, MenuID: item.MenuID, MenuName: item.Name,
			UnitPrice: item.UnitPrice, Quantity: item.Quantity, Toppings: []orders.OrderItemTopping{}}
		for _, topping := range item.Toppings {
			if topping.Soldout || topping.DeletedAt != nil || !topping.LinkedToMenu {
				return nil, 0, ErrUnavailableItems
			}
			snapshot.Toppings = append(snapshot.Toppings, orders.OrderItemTopping{
				StoreID: item.StoreID, ToppingID: topping.ToppingID, ToppingName: topping.Name, UnitPrice: topping.UnitPrice,
			})
		}
		items = append(items, snapshot)
	}
	total, err := orders.CalculateTotalAmount(cart.StoreID, items)
	if err != nil {
		return nil, 0, fmt.Errorf("invalid order items (%v): %w", err, services.ErrInvalidInput)
	}
	return items, total, nil
}
