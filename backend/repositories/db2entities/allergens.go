package db2entities

import (
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/utils"
)

func ToAllergen(allergen sqlc.Allergen) entities.Allergen {
	return entities.Allergen{
		ID:   allergen.ID,
		Name: allergen.Name,
	}
}

func ToAllergens(allergens []sqlc.Allergen) []entities.Allergen {
	return utils.Map(allergens, ToAllergen)
}
