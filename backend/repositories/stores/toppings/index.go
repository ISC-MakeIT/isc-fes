package toppings

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/toppings"
	"github.com/isc-makeit/isc-fes/backend/repositories/db2entities"
	toppings_service "github.com/isc-makeit/isc-fes/backend/services/store/toppings"
)

type ToppingsRepository struct {
	queries *sqlc.Queries
}

func NewToppingsRepository(queries *sqlc.Queries) *ToppingsRepository {
	return &ToppingsRepository{
		queries: queries,
	}
}

func (r *ToppingsRepository) GetToppingsByStoreID(c context.Context, storeID uuid.UUID) ([]toppings.Topping, error) {
	dbToppings, err := r.queries.GetToppingsByStoreID(c, storeID)
	return db2entities.ToToppings(dbToppings), err
}

func (r *ToppingsRepository) CreateTopping(c context.Context, storeID uuid.UUID, name string, unitPrice int32) (toppings.Topping, error) {
	dbTopping, err := r.queries.CreateTopping(c, sqlc.CreateToppingParams{
		StoreID:   storeID,
		Name:      name,
		UnitPrice: unitPrice,
	})
	return db2entities.ToTopping(dbTopping), err
}

var _ toppings_service.ToppingsRepository = (*ToppingsRepository)(nil)
