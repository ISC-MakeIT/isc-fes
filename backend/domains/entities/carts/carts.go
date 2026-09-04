package carts

import (
	"time"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
)

type Cart struct {
	ID      uuid.UUID
	GuestID uuid.UUID
	StoreID uuid.UUID
	Items   []CartItem
}

func (c *Cart) TotalAmount() int64 {
	var total int64
	for _, item := range c.Items {
		total += int64(item.UnitPrice) * int64(item.Quantity)
		for _, topping := range item.Toppings {
			total += int64(topping.UnitPrice) * int64(item.Quantity)
		}
	}

	return total
}

type CartItem struct {
	ID             uuid.UUID
	CartID         uuid.UUID
	MenuID         uuid.UUID
	Name           string
	ImageObjectKey menus.MenuImageObjectKey
	Soldout        bool
	DeletedAt      *time.Time
	StoreID        uuid.UUID
	Quantity       int32
	UnitPrice      int32
	Toppings       []CartItemTopping
}

type CartItemTopping struct {
	ID         uuid.UUID
	CartItemID uuid.UUID
	MenuID     uuid.UUID
	ToppingID  uuid.UUID
	Name       string
	UnitPrice  int32
	Soldout    bool
	DeletedAt  *time.Time
}
