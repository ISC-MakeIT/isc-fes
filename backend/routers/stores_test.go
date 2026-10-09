package routers

import (
	"encoding/json"
	"reflect"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

func TestStoreResponsesIncludeOrderEnabled(t *testing.T) {
	for _, enabled := range []bool{true, false} {
		store := entities.StoreOutput{OrderEnabled: enabled}
		for _, response := range []any{toStoreResponse(store), toStoreApplicationResponse(store)} {
			encoded, err := json.Marshal(response)
			if err != nil {
				t.Fatal(err)
			}
			var fields map[string]any
			if err := json.Unmarshal(encoded, &fields); err != nil {
				t.Fatal(err)
			}
			if got, present := fields["orderEnabled"]; !present || got != enabled {
				t.Errorf("%T orderEnabled = %v (present=%t), want %t", response, got, present, enabled)
			}
		}
	}
}

func TestStoreResponsesIncludeAllergens(t *testing.T) {
	storeID := uuid.New()
	allergenID := uuid.New()
	closedAt := time.Now()
	store := entities.StoreOutput{
		ID:       storeID,
		ClosedAt: &closedAt,
		Allergens: []entities.Allergen{
			{ID: allergenID, Name: "卵"},
		},
	}
	want := []Allergen{{Id: allergenID, Name: "卵"}}

	storeResponse := toStoreResponse(store)
	if !reflect.DeepEqual(storeResponse.Allergens, want) {
		t.Errorf("Store allergens = %v, want %v", storeResponse.Allergens, want)
	}
	if storeResponse.ClosedAt != store.ClosedAt {
		t.Errorf("Store closedAt = %v, want %v", storeResponse.ClosedAt, store.ClosedAt)
	}

	applicationResponse := toStoreApplicationResponse(store)
	if !reflect.DeepEqual(applicationResponse.Allergens, want) {
		t.Errorf("StoreApplication allergens = %v, want %v", applicationResponse.Allergens, want)
	}
}
