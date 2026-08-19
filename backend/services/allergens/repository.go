package allergens

import (
	"context"

	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

type AllergenRepository interface {
	GetAllergens(c context.Context) ([]entities.Allergen, error)
}
