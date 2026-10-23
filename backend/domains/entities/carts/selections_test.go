package carts

import (
	"errors"
	"math"
	"reflect"
	"testing"

	"github.com/google/uuid"
)

func TestValidateSelections(t *testing.T) {
	menuA, menuB, menuC, menuD := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	toppingA, toppingB := uuid.New(), uuid.New()
	for _, test := range []struct {
		name  string
		items []ItemSelection
		want  error
	}{
		{name: "empty cart"},
		{name: "one item", items: []ItemSelection{{MenuID: menuA, Quantity: 1}}},
		{name: "ten items", items: []ItemSelection{{MenuID: menuA, Quantity: 10}}},
		{name: "zero quantity", items: []ItemSelection{{MenuID: menuA, Quantity: 0}}, want: ErrInvalidQuantity},
		{name: "negative quantity", items: []ItemSelection{{MenuID: menuA, Quantity: -1}}, want: ErrInvalidQuantity},
		{name: "eleven items", items: []ItemSelection{{MenuID: menuA, Quantity: 11}}, want: ErrInvalidQuantity},
		{name: "int32 maximum quantity", items: []ItemSelection{{MenuID: menuA, Quantity: math.MaxInt32}}, want: ErrInvalidQuantity},
		{name: "three menus", items: []ItemSelection{
			{MenuID: menuA, Quantity: 1}, {MenuID: menuB, Quantity: 1}, {MenuID: menuC, Quantity: 1},
		}},
		{name: "four menus", items: []ItemSelection{
			{MenuID: menuA, Quantity: 1}, {MenuID: menuB, Quantity: 1}, {MenuID: menuC, Quantity: 1}, {MenuID: menuD, Quantity: 1},
		}, want: ErrTooManyItemTypes},
		{name: "three topping combinations", items: []ItemSelection{
			{MenuID: menuA, Quantity: 10},
			{MenuID: menuA, Quantity: 10, ToppingIDs: []uuid.UUID{toppingA}},
			{MenuID: menuA, Quantity: 10, ToppingIDs: []uuid.UUID{toppingB}},
		}},
		{name: "four topping combinations of one menu", items: []ItemSelection{
			{MenuID: menuA, Quantity: 1},
			{MenuID: menuA, Quantity: 1, ToppingIDs: []uuid.UUID{toppingA}},
			{MenuID: menuA, Quantity: 1, ToppingIDs: []uuid.UUID{toppingB}},
			{MenuID: menuA, Quantity: 1, ToppingIDs: []uuid.UUID{toppingA, toppingB}},
		}, want: ErrTooManyItemTypes},
		{name: "same combination in four rows is one type", items: []ItemSelection{
			{MenuID: menuA, Quantity: 1}, {MenuID: menuA, Quantity: 2}, {MenuID: menuA, Quantity: 3}, {MenuID: menuA, Quantity: 4},
		}},
		{name: "topping order does not affect combined quantity", items: []ItemSelection{
			{MenuID: menuA, Quantity: 6, ToppingIDs: []uuid.UUID{toppingA, toppingB}},
			{MenuID: menuA, Quantity: 4, ToppingIDs: []uuid.UUID{toppingB, toppingA}},
		}},
		{name: "split quantities cannot exceed ten", items: []ItemSelection{
			{MenuID: menuA, Quantity: 6, ToppingIDs: []uuid.UUID{toppingA, toppingB}},
			{MenuID: menuA, Quantity: 5, ToppingIDs: []uuid.UUID{toppingB, toppingA}},
		}, want: ErrInvalidQuantity},
		{name: "duplicate topping IDs cannot bypass combined quantity", items: []ItemSelection{
			{MenuID: menuA, Quantity: 6, ToppingIDs: []uuid.UUID{toppingA}},
			{MenuID: menuA, Quantity: 5, ToppingIDs: []uuid.UUID{toppingA, toppingA}},
		}, want: ErrInvalidQuantity},
		{name: "same toppings on different menus are different types", items: []ItemSelection{
			{MenuID: menuA, Quantity: 10, ToppingIDs: []uuid.UUID{toppingA}},
			{MenuID: menuB, Quantity: 10, ToppingIDs: []uuid.UUID{toppingA}},
		}},
	} {
		t.Run(test.name, func(t *testing.T) {
			if err := ValidateSelections(test.items); !errors.Is(err, test.want) {
				t.Fatalf("ValidateSelections() = %v, want %v", err, test.want)
			}
		})
	}
}

func TestValidateSelectionsDoesNotMutateToppingOrder(t *testing.T) {
	toppings := []uuid.UUID{uuid.MustParse("00000000-0000-0000-0000-000000000002"), uuid.MustParse("00000000-0000-0000-0000-000000000001")}
	want := append([]uuid.UUID(nil), toppings...)
	if err := ValidateSelections([]ItemSelection{{MenuID: uuid.New(), Quantity: 1, ToppingIDs: toppings}}); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(toppings, want) {
		t.Fatalf("topping order changed: got %v, want %v", toppings, want)
	}
}
