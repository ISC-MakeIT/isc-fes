package toppings

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/toppings"
)

type ToppingsRepository interface {
	GetToppingsByStoreID(c context.Context, storeID uuid.UUID) ([]toppings.Topping, error)
	CreateTopping(c context.Context, storeID uuid.UUID, name string, unitPrice int32) (toppings.Topping, error)
	DeleteTopping(c context.Context, storeID, toppingID uuid.UUID) error
}
