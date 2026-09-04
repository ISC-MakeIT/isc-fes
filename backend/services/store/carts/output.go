package carts

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/carts"
	"github.com/isc-makeit/isc-fes/backend/services"
)

type CartOutput struct {
	StoreID     uuid.UUID
	Items       []CartItemOutput
	TotalAmount int64
	CanCheckout bool
}

type CartItemOutput struct {
	ID        uuid.UUID
	MenuID    uuid.UUID
	Name      string
	ImageURL  string
	Available bool
	Quantity  int32
	UnitPrice int32
	Toppings  []CartItemToppingOutput
}

type CartItemToppingOutput struct {
	ID         uuid.UUID
	CartItemID uuid.UUID
	MenuID     uuid.UUID
	ToppingID  uuid.UUID
	Name       string
	UnitPrice  int32
	Available  bool
}

func ToCartOutput(
	ctx context.Context,
	cart carts.Cart,
	store entities.Store,
	imageURLGenerator services.ImageURLGenerator,
) (CartOutput, error) {
	output := CartOutput{
		StoreID:     cart.StoreID,
		Items:       make([]CartItemOutput, len(cart.Items)),
		TotalAmount: cart.TotalAmount(),
		CanCheckout: canCheckout(store, cart.Items),
	}

	for i, item := range cart.Items {
		imageURL, err := imageURLGenerator.GenerateMenuImageURL(ctx, item.ImageObjectKey)
		if err != nil {
			return CartOutput{}, err
		}

		itemAvailable := isCartItemAvailable(item)

		toppings := make([]CartItemToppingOutput, len(item.Toppings))
		for j, topping := range item.Toppings {
			toppingAvailable := isCartItemToppingAvailable(topping)

			toppings[j] = CartItemToppingOutput{
				ID:         topping.ID,
				CartItemID: topping.CartItemID,
				MenuID:     topping.MenuID,
				ToppingID:  topping.ToppingID,
				Name:       topping.Name,
				UnitPrice:  topping.UnitPrice,
				Available:  toppingAvailable,
			}
		}

		output.Items[i] = CartItemOutput{
			ID:        item.ID,
			MenuID:    item.MenuID,
			Name:      item.Name,
			ImageURL:  imageURL,
			Available: itemAvailable,
			Quantity:  item.Quantity,
			UnitPrice: item.UnitPrice,
			Toppings:  toppings,
		}
	}

	return output, nil
}

func canCheckout(store entities.Store, items []carts.CartItem) bool {
	if store.ClosedAt != nil || len(items) == 0 {
		return false
	}

	for _, item := range items {
		if !isCartItemAvailable(item) {
			return false
		}
		for _, topping := range item.Toppings {
			if !isCartItemToppingAvailable(topping) {
				return false
			}
		}
	}

	return true
}

func isCartItemAvailable(item carts.CartItem) bool {
	return !item.Soldout && item.DeletedAt == nil
}

func isCartItemToppingAvailable(topping carts.CartItemTopping) bool {
	return !topping.Soldout && topping.DeletedAt == nil
}
