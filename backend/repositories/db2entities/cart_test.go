package db2entities

import (
	"reflect"
	"testing"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/carts"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
)

func TestToCart(t *testing.T) {
	cartID := testUUID("cart-id")
	guestID := testUUID("guest-id")
	storeID := testUUID("store-id")
	menuID1 := testUUID("menu-id-1")
	menuID2 := testUUID("menu-id-2")
	menuImageObjectKey1 := menus.NewMenuImageObjectKey(menuID1)
	menuImageObjectKey2 := menus.NewMenuImageObjectKey(menuID2)

	want := carts.Cart{
		ID:      cartID,
		Version: 3,
		GuestID: guestID,
		StoreID: storeID,

		Items: []carts.CartItem{
			{
				ID:             testUUID("cart-item-id-1"),
				CartID:         cartID,
				MenuID:         menuID1,
				Name:           "menu-1",
				ImageObjectKey: menuImageObjectKey1,
				StoreID:        storeID,
				Quantity:       2,
				UnitPrice:      500,
				Toppings:       []carts.CartItemTopping{},
			},
			{
				ID:             testUUID("cart-item-id-2"),
				CartID:         cartID,
				MenuID:         menuID1,
				Name:           "menu-1",
				ImageObjectKey: menuImageObjectKey1,
				StoreID:        storeID,
				Quantity:       1,
				UnitPrice:      500,
				Toppings: []carts.CartItemTopping{
					{
						ID:         testUUID("cart-item-topping-id-2"),
						CartItemID: testUUID("cart-item-id-2"),
						MenuID:     menuID1,
						ToppingID:  testUUID("topping-id-1"),
						Name:       "topping-1",
						UnitPrice:  50,
					},
				},
			},
			{
				ID:             testUUID("cart-item-id-3"),
				CartID:         cartID,
				MenuID:         menuID2,
				Name:           "menu-2",
				ImageObjectKey: menuImageObjectKey2,
				StoreID:        storeID,
				Quantity:       1,
				UnitPrice:      200,
				Toppings: []carts.CartItemTopping{
					{
						ID:         testUUID("cart-item-topping-id-1"),
						CartItemID: testUUID("cart-item-id-3"),
						MenuID:     menuID2,
						ToppingID:  testUUID("topping-id-1"),
						Name:       "topping-1",
						UnitPrice:  50,
					},
				},
			},
		},
	}

	cartItemToppingID1 := testUUID("cart-item-topping-id-1")
	cartItemToppingID2 := testUUID("cart-item-topping-id-2")
	toppingID1 := testUUID("topping-id-1")
	toppingName1 := "topping-1"
	toppingUnitPrice50 := int32(50)
	toppingSoldOut := false

	raw := []sqlc.GetCartByGuestIDAndStoreIDRow{
		{
			CartID:             cartID,
			CartVersion:        3,
			GuestID:            guestID,
			StoreID:            storeID,
			CartItemID:         pointerTo(testUUID("cart-item-id-1")),
			CartItemQuantity:   pointerTo(int32(2)),
			MenuID:             &menuID1,
			MenuName:           pointerTo("menu-1"),
			MenuUnitPrice:      pointerTo(int32(500)),
			MenuImageObjectKey: pointerTo(menuImageObjectKey1.String()),
			MenuSoldOut:        pointerTo(false),
		},
		{
			CartID:             cartID,
			CartVersion:        3,
			GuestID:            guestID,
			StoreID:            storeID,
			CartItemID:         pointerTo(testUUID("cart-item-id-2")),
			CartItemQuantity:   pointerTo(int32(1)),
			MenuID:             &menuID1,
			MenuName:           pointerTo("menu-1"),
			MenuUnitPrice:      pointerTo(int32(500)),
			MenuImageObjectKey: pointerTo(menuImageObjectKey1.String()),
			MenuSoldOut:        pointerTo(false),
			CartItemToppingID:  &cartItemToppingID2,
			ToppingID:          &toppingID1,
			ToppingName:        &toppingName1,
			ToppingUnitPrice:   &toppingUnitPrice50,
			ToppingSoldOut:     &toppingSoldOut,
		},
		{
			CartID:             cartID,
			CartVersion:        3,
			GuestID:            guestID,
			StoreID:            storeID,
			CartItemID:         pointerTo(testUUID("cart-item-id-3")),
			CartItemQuantity:   pointerTo(int32(1)),
			MenuID:             &menuID2,
			MenuName:           pointerTo("menu-2"),
			MenuUnitPrice:      pointerTo(int32(200)),
			MenuImageObjectKey: pointerTo(menuImageObjectKey2.String()),
			MenuSoldOut:        pointerTo(false),
			CartItemToppingID:  &cartItemToppingID1,
			ToppingID:          &toppingID1,
			ToppingName:        &toppingName1,
			ToppingUnitPrice:   &toppingUnitPrice50,
			ToppingSoldOut:     &toppingSoldOut,
		},
	}

	got := ToCart(raw)
	if !reflect.DeepEqual(got, want) {
		t.Errorf("ToCart() = %v, want %v", got, want)
	}
}

func TestToCartReturnsSavedEmptyCart(t *testing.T) {
	cartID := testUUID("empty-cart-id")
	guestID := testUUID("empty-cart-guest-id")
	storeID := testUUID("empty-cart-store-id")

	got := ToCart([]sqlc.GetCartByGuestIDAndStoreIDRow{
		{
			CartID:      cartID,
			CartVersion: 4,
			GuestID:     guestID,
			StoreID:     storeID,
		},
	})

	want := carts.Cart{
		ID:      cartID,
		Version: 4,
		GuestID: guestID,
		StoreID: storeID,
		Items:   []carts.CartItem{},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("ToCart() = %v, want %v", got, want)
	}
}

func pointerTo[T any](value T) *T {
	return &value
}

func testUUID(name string) uuid.UUID {
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte(name))
}
