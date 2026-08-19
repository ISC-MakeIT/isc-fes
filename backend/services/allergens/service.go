package allergens

import (
	"context"

	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

type AllergenService struct {
	allergenRepository AllergenRepository
}

func NewAllergenService(allergenRepository AllergenRepository) *AllergenService {
	return &AllergenService{
		allergenRepository: allergenRepository,
	}
}

func (s *AllergenService) GetAllergens(c context.Context) ([]entities.Allergen, error) {
	return s.allergenRepository.GetAllergens(c)
}
