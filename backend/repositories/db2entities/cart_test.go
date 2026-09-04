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
			GuestID:            guestID,
			StoreID:            storeID,
			CartItemID:         testUUID("cart-item-id-1"),
			CartItemQuantity:   2,
			MenuID:             menuID1,
			MenuName:           "menu-1",
			MenuUnitPrice:      500,
			MenuImageObjectKey: menuImageObjectKey1.String(),
		},
		{
			CartID:             cartID,
			GuestID:            guestID,
			StoreID:            storeID,
			CartItemID:         testUUID("cart-item-id-2"),
			CartItemQuantity:   1,
			MenuID:             menuID1,
			MenuName:           "menu-1",
			MenuUnitPrice:      500,
			MenuImageObjectKey: menuImageObjectKey1.String(),
			CartItemToppingID:  &cartItemToppingID2,
			ToppingID:          &toppingID1,
			ToppingName:        &toppingName1,
			ToppingUnitPrice:   &toppingUnitPrice50,
			ToppingSoldOut:     &toppingSoldOut,
		},
		{
			CartID:             cartID,
			GuestID:            guestID,
			StoreID:            storeID,
			CartItemID:         testUUID("cart-item-id-3"),
			CartItemQuantity:   1,
			MenuID:             menuID2,
			MenuName:           "menu-2",
			MenuUnitPrice:      200,
			MenuImageObjectKey: menuImageObjectKey2.String(),
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

func testUUID(name string) uuid.UUID {
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte(name))
}
