package routers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	servicecarts "github.com/isc-makeit/isc-fes/backend/services/store/carts"
	"github.com/isc-makeit/isc-fes/backend/utils"
)

func (s *Server) GetStoreCart(c *gin.Context, storeID uuid.UUID) {
	cart, err := s.cart.GetCart(c.Request.Context(), storeID)
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusOK, toCartResponse(cart))
}

func toCartResponse(cart servicecarts.CartOutput) Cart {
	return Cart{
		CanCheckout: cart.CanCheckout,
		StoreId:     cart.StoreID,
		Items:       utils.Map(cart.Items, toCartItemResponse),
		TotalAmount: int(cart.TotalAmount),
	}
}

func toCartItemResponse(item servicecarts.CartItemOutput) CartItem {
	return CartItem{
		Id:        item.ID,
		MenuId:    item.MenuID,
		Name:      item.Name,
		ImageUrl:  item.ImageURL,
		Available: item.Available,
		Quantity:  item.Quantity,
		UnitPrice: item.UnitPrice,
		Toppings:  utils.Map(item.Toppings, toCartItemToppingResponse),
	}
}

func toCartItemToppingResponse(topping servicecarts.CartItemToppingOutput) CartItemTopping {
	return CartItemTopping{
		Id:         &topping.ID,
		CartItemId: &topping.CartItemID,
		MenuId:     topping.MenuID,
		ToppingId:  topping.ToppingID,
		Name:       topping.Name,
		Available:  topping.Available,
		UnitPrice:  topping.UnitPrice,
	}
}
