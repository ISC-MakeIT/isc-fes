package orders

import (
	"context"
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
	ErrStoreOrderDisabled  = fmt.Errorf("store order acceptance is disabled: %w", services.ErrForbidden)
	ErrCartEmpty           = fmt.Errorf("cart is empty: %w", services.ErrInvalidInput)
	ErrInvalidCart         = fmt.Errorf("invalid cart: %w", services.ErrInvalidInput)
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

// CreateResultはコミットに成功した注文と、同じカートversionの再実行かどうかを表す。
type CreateResult struct {
	Order    orders.Order
	Replayed bool
}

// 注文の作成・取得・店舗による状態更新に必要な操作を要求する。
type Repository interface {
	CreateOrder(context.Context, CreateRepositoryInput) (CreateResult, error)
	CheckCheckout(context.Context, CreateRepositoryInput) error
	UpdateOrder(context.Context, UpdateRepositoryInput) (UpdateResult, error)
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

// OrderStatusNotifierはコミット済みの新規注文・状態変更を通知する。通知失敗は注文結果を変更しない。
// HTTPリクエストが終了しても配信できるよう、リクエストcontextは渡さない。
type OrderStatusNotifier interface {
	NotifyStatusChanged(orders.Order)
}

type OrderService struct {
	statusNotifier            OrderStatusNotifier
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
	statusNotifier OrderStatusNotifier,
) *OrderService {
	return &OrderService{
		statusNotifier: statusNotifier, repository: repository, accountLoader: accountLoader, guestResolver: guestResolver,
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
	accountID, err := s.resolveOptionalAccountID(ctx)
	if err != nil {
		return CreateResult{}, err
	}
	repoInput := CreateRepositoryInput{CreateInput: input, GuestID: guestID, AccountID: accountID}
	result, err := s.repository.CreateOrder(ctx, repoInput)
	if err != nil {
		return CreateResult{}, err
	}
	if !result.Replayed && s.statusNotifier != nil {
		s.statusNotifier.NotifyStatusChanged(result.Order)
	}
	return result, nil
}

// PrepareItemsは注文確定または事前チェックで取得したカートを検証する。
// 利用不可の選択を除外せず、全体を拒否する。金額は注文ドメインに委ねる。
func PrepareItems(cart carts.Cart) ([]orders.OrderItem, int64, error) {
	if len(cart.Items) == 0 {
		return nil, 0, ErrCartEmpty
	}
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
		return nil, 0, fmt.Errorf("invalid order items (%v): %w", err, ErrInvalidCart)
	}
	return items, total, nil
}
