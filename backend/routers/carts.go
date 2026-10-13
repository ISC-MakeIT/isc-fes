package routers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	orderservice "github.com/isc-makeit/isc-fes/backend/services/orders"
	servicecarts "github.com/isc-makeit/isc-fes/backend/services/store/carts"
	"github.com/isc-makeit/isc-fes/backend/utils"
)

func (s *Server) GetStoreCartCheckoutable(c *gin.Context, storeID uuid.UUID, params GetStoreCartCheckoutableParams) {
	c.Header("Cache-Control", "no-store")
	err := s.orders.CheckCheckout(c.Request.Context(), orderservice.CreateInput{
		StoreID: storeID, ExpectedCartVersion: params.ExpectedCartVersion,
	})
	var code CheckoutCheckResponseCode
	switch {
	case err == nil:
		c.JSON(http.StatusOK, CheckoutCheckResponse{Code: nil})
		return
	case errors.Is(err, orderservice.ErrStoreClosed):
		code = StoreClosed
	case errors.Is(err, orderservice.ErrStoreOrderDisabled):
		code = StoreOrderDisabled
	case errors.Is(err, orderservice.ErrCartVersionConflict):
		code = CartVersionConflict
	case errors.Is(err, orderservice.ErrCartEmpty):
		code = CartEmpty
	case errors.Is(err, orderservice.ErrUnavailableItems):
		code = CartItemsUnavailable
	case errors.Is(err, orderservice.ErrInvalidCart):
		code = InvalidCart
	case errors.Is(err, orderservice.ErrOrderLimitReached):
		code = OrderLimitReached
	default:
		s.handleCommonServiceErrors(c, err)
		return
	}
	c.JSON(http.StatusOK, CheckoutCheckResponse{Code: &code})
}

func (s *Server) GetStoreCart(c *gin.Context, storeID uuid.UUID) {
	cart, err := s.cart.GetCart(c.Request.Context(), storeID)
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusOK, toCartResponse(cart))
}

func (s *Server) UpdateStoreCart(c *gin.Context, storeID uuid.UUID) {
	var input UpdateCartInput
	if err := c.ShouldBindJSON(&input); err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	cart, err := s.cart.UpdateCartByStoreID(c.Request.Context(), servicecarts.UpdateCartInput{
		ExpectedVersion: input.ExpectedVersion,
		StoreID:         storeID,
		Items: utils.Map(input.Items, func(i UpdateCartItemInput) servicecarts.UpdateCartItemInput {
			return servicecarts.UpdateCartItemInput{
				ID:         i.Id,
				MenuID:     i.MenuId,
				Quantity:   i.Quantity,
				ToppingIds: i.ToppingIds,
			}
		}),
	})
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusOK, toCartResponse(cart))
}

func toCartResponse(cart servicecarts.CartOutput) Cart {
	return Cart{
		StoreId:     cart.StoreID,
		Version:     cart.Version,
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
		Id:         topping.ID,
		CartItemId: topping.CartItemID,
		ToppingId:  topping.ToppingID,
		Name:       topping.Name,
		Available:  topping.Available,
		UnitPrice:  topping.UnitPrice,
	}
}
