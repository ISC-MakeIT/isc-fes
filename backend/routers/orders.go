package routers

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	domain "github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/services"
	orderservice "github.com/isc-makeit/isc-fes/backend/services/orders"
)

func (s *Server) CreateOrder(c *gin.Context) {
	var body CreateOrderJSONRequestBody
	if err := c.ShouldBindJSON(&body); err != nil {
		s.handleCommonServiceErrors(c, services.ErrInvalidInput)
		return
	}
	result, err := s.orders.CreateOrder(c.Request.Context(), orderservice.CreateInput{
		StoreID: body.StoreId, ExpectedCartVersion: body.ExpectedCartVersion,
	})
	if err != nil {
		messages := CommonErrorMessages{InvalidInput: "カートの内容が不正です"}
		switch {
		case errors.Is(err, orderservice.ErrCartVersionConflict):
			messages.Conflict = "カートが更新されています。再読み込みしてください"
		case errors.Is(err, orderservice.ErrUnavailableItems):
			messages.Conflict = "利用できない商品またはトッピングが含まれています"
		case errors.Is(err, orderservice.ErrOrderLimitReached):
			messages.Conflict = fmt.Sprintf("同時に注文できるのは%d件までです", domain.MaxActiveOrders)
		case errors.Is(err, orderservice.ErrStoreClosed):
			messages.Conflict = "店舗は閉店しています"
		}
		s.handleCommonServiceErrors(c, err, messages)
		return
	}
	status := http.StatusCreated
	if result.Replayed {
		status = http.StatusOK
	}
	c.JSON(status, toOrderResponse(result.Order))
}

func toOrderResponse(order domain.Order) Order {
	result := Order{
		Id:            order.ID,
		StoreId:       order.StoreID,
		Status:        OrderStatus(order.Status),
		TotalAmount:   order.TotalAmount,
		DisplayNumber: order.DisplayNumber,
		Version:       order.Version,
		StoreName:     order.StoreName,
		RoomName:      order.RoomName,
		Items:         make([]OrderItem, 0, len(order.Items)),
		ReadyAt:       order.ReadyAt,
		CompletedAt:   order.CompletedAt,
		CancelledAt:   order.CancelledAt,
		CreatedAt:     order.CreatedAt,
		UpdatedAt:     order.UpdatedAt,
	}
	for _, item := range order.Items {
		snapshot := OrderItem{Id: item.ID,
			MenuId:    item.MenuID,
			MenuName:  item.MenuName,
			UnitPrice: item.UnitPrice,
			Quantity:  item.Quantity,
			Toppings:  make([]OrderItemTopping, 0, len(item.Toppings)),
		}
		for _, topping := range item.Toppings {
			snapshot.Toppings = append(snapshot.Toppings, OrderItemTopping{
				ToppingId: topping.ToppingID, ToppingName: topping.ToppingName, UnitPrice: topping.UnitPrice,
			})
		}
		result.Items = append(result.Items, snapshot)
	}
	return result
}
