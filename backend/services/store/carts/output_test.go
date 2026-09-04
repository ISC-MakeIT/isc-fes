package carts

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
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

	got, err := ToCartOutput(t.Context(), cart, entities.Store{}, generator)
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

	_, err := ToCartOutput(t.Context(), cart, entities.Store{}, generator)
	if !errors.Is(err, wantErr) {
		t.Fatalf("ToCartOutput() error = %v, want %v", err, wantErr)
	}
}

func TestToCartOutputCanCheckout(t *testing.T) {
	now := time.Now()
	availableItem := carts.CartItem{
		ImageObjectKey: menus.NewMenuImageObjectKey(uuid.New()),
	}
	availableTopping := carts.CartItemTopping{}

	tests := []struct {
		name  string
		store entities.Store
		items []carts.CartItem
		want  bool
	}{
		{
			name:  "available cart",
			items: []carts.CartItem{availableItem},
			want:  true,
		},
		{
			name:  "empty cart",
			items: []carts.CartItem{},
			want:  false,
		},
		{
			name:  "closed store",
			store: entities.Store{ClosedAt: &now},
			items: []carts.CartItem{availableItem},
			want:  false,
		},
		{
			name: "sold out menu",
			items: []carts.CartItem{{
				ImageObjectKey: menus.NewMenuImageObjectKey(uuid.New()),
				Soldout:        true,
			}},
			want: false,
		},
		{
			name: "deleted menu",
			items: []carts.CartItem{{
				ImageObjectKey: menus.NewMenuImageObjectKey(uuid.New()),
				DeletedAt:      &now,
			}},
			want: false,
		},
		{
			name: "sold out topping",
			items: []carts.CartItem{{
				ImageObjectKey: menus.NewMenuImageObjectKey(uuid.New()),
				Toppings: []carts.CartItemTopping{{
					Soldout: true,
				}},
			}},
			want: false,
		},
		{
			name: "deleted topping",
			items: []carts.CartItem{{
				ImageObjectKey: menus.NewMenuImageObjectKey(uuid.New()),
				Toppings: []carts.CartItemTopping{{
					DeletedAt: &now,
				}},
			}},
			want: false,
		},
		{
			name: "available topping",
			items: []carts.CartItem{{
				ImageObjectKey: menus.NewMenuImageObjectKey(uuid.New()),
				Toppings:       []carts.CartItemTopping{availableTopping},
			}},
			want: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			generator := &recordingMenuImageURLGenerator{
				urls: map[menus.MenuImageObjectKey]string{},
			}
			cart := carts.Cart{Items: tt.items}

			got, err := ToCartOutput(t.Context(), cart, tt.store, generator)
			if err != nil {
				t.Fatalf("ToCartOutput() error = %v", err)
			}
			if got.CanCheckout != tt.want {
				t.Errorf("ToCartOutput().CanCheckout = %v, want %v", got.CanCheckout, tt.want)
			}
		})
	}
}
