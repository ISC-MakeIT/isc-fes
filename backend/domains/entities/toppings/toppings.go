package toppings

import (
	"time"

	"github.com/google/uuid"
)

type Topping struct {
	ID        uuid.UUID
	StoreID   uuid.UUID
	Name      string
	UnitPrice int32
	SoldOut   bool
	DeletedAt *time.Time
	UpdatedAt time.Time
	CreatedAt time.Time
}
