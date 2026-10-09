package orders

import (
	"time"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

const MaxActiveOrders = 2

// Order は注文確定時のsnapshot。現在の商品情報から再計算しない。
type Order struct {
	ID                       uuid.UUID
	StoreID                  uuid.UUID
	GuestID                  uuid.UUID
	Status                   OrderStatus
	TotalAmount              int64
	DisplayNumber            int32
	Version                  int32
	OriginCartID             uuid.UUID
	OriginCartVersion        int32
	LimitExemptedByAccountID *uuid.UUID
	StoreName                string
	RoomName                 string
	Items                    []OrderItem
	ReadyAt                  *time.Time
	CompletedAt              *time.Time
	CancelledAt              *time.Time
	CreatedAt                time.Time
	UpdatedAt                time.Time
}

type OrderItem struct {
	ID        uuid.UUID
	OrderID   uuid.UUID
	StoreID   uuid.UUID
	MenuID    uuid.UUID
	MenuName  string
	UnitPrice int32
	Quantity  int32
	Toppings  []OrderItemTopping
}

// OrderItemTopping の単価は商品1個あたりの追加料金。
type OrderItemTopping struct {
	OrderItemID uuid.UUID
	StoreID     uuid.UUID
	ToppingID   uuid.UUID
	ToppingName string
	UnitPrice   int32
}

// CanExemptOrderLimit は、当該店舗のStaff/Managerによる注文の件数制限を免除できるか判定する。
func CanExemptOrderLimit(storeID uuid.UUID, membership entities.StoreMembership) bool {
	return membership.StoreID == storeID &&
		(membership.Role == entities.StoreMemberRoleStaff || membership.Role == entities.StoreMemberRoleManager)
}

// CanViewStoreOrders は、当該店舗のStaff/Managerが店舗の注文を閲覧できるか判定する。
func CanViewStoreOrders(storeID uuid.UUID, membership entities.StoreMembership) bool {
	return membership.StoreID == storeID &&
		(membership.Role == entities.StoreMemberRoleStaff || membership.Role == entities.StoreMemberRoleManager)
}

// IsOrderLimitReached は、全店舗を通じた免除なしのpending/ready注文数が上限に達しているか判定する。
// 件数制限を免除する注文では、この判定を適用しない。
func IsOrderLimitReached(activeNonExemptOrderCount int64) bool {
	return activeNonExemptOrderCount >= MaxActiveOrders
}
