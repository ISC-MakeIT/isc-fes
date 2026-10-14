package carts

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/carts"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/isc-makeit/isc-fes/backend/services"
)

type recordingMenuImageURLGenerator struct {
	services.ImageURLGenerator
	urls  map[menus.MenuImageObjectKey]string
	calls []menus.MenuImageObjectKey
	err   error
}

func (g *recordingMenuImageURLGenerator) GenerateMenuImageURL(_ context.Context, key menus.MenuImageObjectKey) (string, error) {
	g.calls = append(g.calls, key)
	if g.err != nil {
		return "", g.err
	}
	return g.urls[key], nil
}

func TestToCartOutputGeneratesImageURLForEachCartItem(t *testing.T) {
	firstKey := menus.MenuImageObjectKey("menus/first/image")
	secondKey := menus.MenuImageObjectKey("menus/second/image")
	cart := carts.Cart{
		StoreID: uuid.New(),
		Items: []carts.CartItem{
			{ID: uuid.New(), ImageObjectKey: firstKey},
			{ID: uuid.New(), ImageObjectKey: secondKey},
		},
	}
	generator := &recordingMenuImageURLGenerator{
		urls: map[menus.MenuImageObjectKey]string{
			firstKey:  "https://example.com/first.webp",
			secondKey: "https://example.com/second.webp",
		},
	}

	got, err := ToCartOutput(t.Context(), cart, generator)
	if err != nil {
		t.Fatalf("ToCartOutput() error = %v", err)
	}

	if got.StoreID != cart.StoreID {
		t.Errorf("ToCartOutput().StoreID = %v, want %v", got.StoreID, cart.StoreID)
	}
	if got.Items[0].ImageURL != "https://example.com/first.webp" {
		t.Errorf("first ImageURL = %q", got.Items[0].ImageURL)
	}
	if got.Items[1].ImageURL != "https://example.com/second.webp" {
		t.Errorf("second ImageURL = %q", got.Items[1].ImageURL)
	}
	wantCalls := []menus.MenuImageObjectKey{firstKey, secondKey}
	if !reflect.DeepEqual(generator.calls, wantCalls) {
		t.Errorf("GenerateMenuImageURL() calls = %v, want %v", generator.calls, wantCalls)
	}
}

func TestToCartOutputReturnsImageURLGenerationError(t *testing.T) {
	wantErr := errors.New("generate image URL")
	generator := &recordingMenuImageURLGenerator{err: wantErr}
	cart := carts.Cart{
		Items: []carts.CartItem{{ImageObjectKey: menus.MenuImageObjectKey("menus/first/image")}},
	}

	_, err := ToCartOutput(t.Context(), cart, generator)
	if !errors.Is(err, wantErr) {
		t.Fatalf("ToCartOutput() error = %v, want %v", err, wantErr)
	}
}

func TestToCartOutputAvailability(t *testing.T) {
	now := time.Now()
	for _, test := range []struct {
		name        string
		item        carts.CartItem
		wantItem    bool
		wantTopping bool
	}{
		{"available", carts.CartItem{Toppings: []carts.CartItemTopping{{LinkedToMenu: true}}}, true, true},
		{"sold out menu", carts.CartItem{Soldout: true}, false, false},
		{"deleted menu", carts.CartItem{DeletedAt: &now}, false, false},
		{"sold out topping", carts.CartItem{Toppings: []carts.CartItemTopping{{Soldout: true, LinkedToMenu: true}}}, true, false},
		{"deleted topping", carts.CartItem{Toppings: []carts.CartItemTopping{{DeletedAt: &now, LinkedToMenu: true}}}, true, false},
		{"detached topping", carts.CartItem{Toppings: []carts.CartItemTopping{{LinkedToMenu: false}}}, true, false},
	} {
		t.Run(test.name, func(t *testing.T) {
			got, err := ToCartOutput(t.Context(), carts.Cart{Items: []carts.CartItem{test.item}}, &recordingMenuImageURLGenerator{})
			if err != nil {
				t.Fatal(err)
			}
			if len(got.Items) != 1 || got.Items[0].Available != test.wantItem || len(got.Items[0].Toppings) != len(test.item.Toppings) {
				t.Fatalf("unexpected item: %+v", got.Items)
			}
			for _, topping := range got.Items[0].Toppings {
				if topping.Available != test.wantTopping {
					t.Fatalf("unexpected topping: %+v", topping)
				}
			}
		})
	}
}

func TestToCartOutputKeepsDetachedSelectionAndAmount(t *testing.T) {
	toppingID := uuid.New()
	cart := carts.Cart{Items: []carts.CartItem{{
		ID: uuid.New(), Quantity: 2, UnitPrice: 300,
		Toppings: []carts.CartItemTopping{{
			ID: uuid.New(), ToppingID: toppingID, Name: "目玉焼き", UnitPrice: 50,
			LinkedToMenu: false,
		}},
	}}}
	got, err := ToCartOutput(t.Context(), cart, &recordingMenuImageURLGenerator{})
	if err != nil {
		t.Fatal(err)
	}
	if len(got.Items) != 1 || len(got.Items[0].Toppings) != 1 {
		t.Fatalf("selection lost: %#v", got.Items)
	}
	topping := got.Items[0].Toppings[0]
	if topping.ToppingID != toppingID || topping.Name != "目玉焼き" || topping.UnitPrice != 50 {
		t.Fatalf("selection changed: %#v", topping)
	}
	if topping.Available || got.TotalAmount != 700 {
		t.Fatalf("detached cart: available=%v, amount=%d", topping.Available, got.TotalAmount)
	}
}
