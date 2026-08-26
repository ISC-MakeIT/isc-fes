package routers

import (
	"reflect"
	"testing"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

func TestStoreResponsesIncludeAllergens(t *testing.T) {
	storeID := uuid.New()
	allergenID := uuid.New()
	store := entities.StoreOutput{
		ID: storeID,
		Allergens: []entities.Allergen{
			{ID: allergenID, Name: "卵"},
		},
	}
	want := []Allergen{{Id: allergenID, Name: "卵"}}

	storeResponse := toStoreResponse(store)
	if !reflect.DeepEqual(storeResponse.Allergens, want) {
		t.Errorf("Store allergens = %v, want %v", storeResponse.Allergens, want)
	}

	applicationResponse := toStoreApplicationResponse(store)
	if !reflect.DeepEqual(applicationResponse.Allergens, want) {
		t.Errorf("StoreApplication allergens = %v, want %v", applicationResponse.Allergens, want)
	}
}
