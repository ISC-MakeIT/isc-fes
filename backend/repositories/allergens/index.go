package allergens

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/repositories/db2entities"
	allergens_service "github.com/isc-makeit/isc-fes/backend/services/allergens"
)

type AllergenRepository struct {
	queries *sqlc.Queries
}

func NewAllergenRepository(queries *sqlc.Queries) *AllergenRepository {
	return &AllergenRepository{
		queries: queries,
	}
}

func (r *AllergenRepository) GetAllergens(c context.Context) ([]entities.Allergen, error) {
	allergens, err := r.queries.GetAllergens(c)
	return db2entities.ToAllergens(allergens), err
}

func (r *AllergenRepository) GetStoreAllergensByStoreIDs(c context.Context, storeIDs []uuid.UUID) (map[uuid.UUID][]entities.Allergen, error) {
	storeAllergens := make(map[uuid.UUID][]entities.Allergen, len(storeIDs))
	for _, storeID := range storeIDs {
		storeAllergens[storeID] = []entities.Allergen{}
	}

	rows, err := r.queries.GetStoreAllergensByStoreIDs(c, storeIDs)
	if err != nil {
		return nil, err
	}

	for _, row := range rows {
		storeAllergens[row.StoreID] = append(storeAllergens[row.StoreID], entities.Allergen{
			ID:   row.ID,
			Name: row.Name,
		})
	}

	return storeAllergens, nil
}

var _ allergens_service.AllergenRepository = &AllergenRepository{}
