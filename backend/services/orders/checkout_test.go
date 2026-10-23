package orders

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/carts"
	"github.com/isc-makeit/isc-fes/backend/services"
)

func TestPrepareItemsCheckoutReasons(t *testing.T) {
	storeID := uuid.New()
	now := time.Now()
	for _, test := range []struct {
		name   string
		mutate func(*carts.Cart)
		want   error
	}{
		{"available", func(*carts.Cart) {}, nil},
		{"empty", func(c *carts.Cart) { c.Items = nil }, ErrCartEmpty},
		{"sold out menu", func(c *carts.Cart) { c.Items[0].Soldout = true }, ErrUnavailableItems},
		{"deleted menu", func(c *carts.Cart) { c.Items[0].DeletedAt = &now }, ErrUnavailableItems},
		{"sold out topping", func(c *carts.Cart) { c.Items[0].Toppings[0].Soldout = true }, ErrUnavailableItems},
		{"deleted topping", func(c *carts.Cart) { c.Items[0].Toppings[0].DeletedAt = &now }, ErrUnavailableItems},
		{"detached topping", func(c *carts.Cart) { c.Items[0].Toppings[0].LinkedToMenu = false }, ErrUnavailableItems},
		{"invalid quantity", func(c *carts.Cart) { c.Items[0].Quantity = 0 }, ErrInvalidCart},
		{"eleven items", func(c *carts.Cart) { c.Items[0].Quantity = 11 }, ErrInvalidCart},
		{"split quantity exceeds ten", func(c *carts.Cart) {
			other := c.Items[0]
			other.Quantity = 9
			c.Items = append(c.Items, other)
		}, ErrInvalidCart},
		{"four combinations of one menu", func(c *carts.Cart) {
			item := c.Items[0]
			c.Items = nil
			for range 4 {
				variant := item
				variant.Toppings = []carts.CartItemTopping{{ToppingID: uuid.New(), UnitPrice: 50, LinkedToMenu: true}}
				c.Items = append(c.Items, variant)
			}
		}, ErrInvalidCart},
	} {
		t.Run(test.name, func(t *testing.T) {
			cart := carts.Cart{StoreID: storeID, Items: []carts.CartItem{{
				StoreID: storeID, MenuID: uuid.New(), Quantity: 2, UnitPrice: 300,
				Toppings: []carts.CartItemTopping{{ToppingID: uuid.New(), UnitPrice: 50, LinkedToMenu: true}},
			}}}
			test.mutate(&cart)
			items, total, err := PrepareItems(cart)
			if !errors.Is(err, test.want) {
				t.Fatalf("error = %v, want %v", err, test.want)
			}
			if err == nil && (total != 700 || len(items) != 1 || len(items[0].Toppings) != 1) {
				t.Fatalf("snapshot = %+v, total = %d", items, total)
			}
			if test.want == ErrCartEmpty || test.want == ErrInvalidCart {
				if !errors.Is(err, services.ErrInvalidInput) {
					t.Fatal("POST invalid input classification changed")
				}
			}
		})
	}
}
