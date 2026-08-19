package allergens

import (
	"context"

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

var _ allergens_service.AllergenRepository = &AllergenRepository{}
