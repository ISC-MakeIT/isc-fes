package orders

import (
	"time"

	"github.com/google/uuid"
)

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
