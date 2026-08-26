package allergens

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

type AllergenRepository interface {
	GetAllergens(c context.Context) ([]entities.Allergen, error)
	GetStoreAllergensByStoreIDs(c context.Context, storeIDs []uuid.UUID) (map[uuid.UUID][]entities.Allergen, error)
}
