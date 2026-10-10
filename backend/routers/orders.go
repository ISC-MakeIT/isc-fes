package routers

import (
	"errors"
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	domain "github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/services"
	orderservice "github.com/isc-makeit/isc-fes/backend/services/orders"
	"github.com/isc-makeit/isc-fes/backend/utils"
)

func (s *Server) GetOrders(c *gin.Context, params GetOrdersParams) {
	var statuses []domain.OrderStatus
	if params.Statuses != nil {
		statuses = utils.Map(*params.Statuses, func(status OrderStatus) domain.OrderStatus {
			return domain.OrderStatus(status)
		})
	}
	orders, err := s.orders.GetOrders(c.Request.Context(), statuses)
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}
	c.JSON(http.StatusOK, GetOrdersResponse{Data: utils.Map(orders, toOrderResponse), Total: len(orders)})
}

func (s *Server) GetOrderByID(c *gin.Context, orderID uuid.UUID) {
	order, err := s.orders.GetOrderByID(c.Request.Context(), orderID)
	if err != nil {
		s.handleCommonServiceErrors(c, err, CommonErrorMessages{NotFound: "注文が見つかりません"})
		return
	}
	c.JSON(http.StatusOK, toOrderResponse(order))
}

func (s *Server) GetOrdersByStoreID(c *gin.Context, storeID uuid.UUID, params GetOrdersByStoreIDParams) {
	var statuses []domain.OrderStatus
	if params.Statuses != nil {
		statuses = utils.Map(*params.Statuses, func(status OrderStatus) domain.OrderStatus {
			return domain.OrderStatus(status)
		})
	}
	orders, err := s.orders.GetOrdersByStoreID(c.Request.Context(), storeID, statuses)
	if err != nil {
		s.handleCommonServiceErrors(c, err, CommonErrorMessages{NotFound: "店舗が見つかりません"})
		return
	}
	c.JSON(http.StatusOK, GetOrdersResponse{Data: utils.Map(orders, toOrderResponse), Total: len(orders)})
}

func (s *Server) UpdateOrderByStoreIDAndOrderID(c *gin.Context, storeID uuid.UUID, orderID uuid.UUID) {
	var body UpdateOrderByStoreIDAndOrderIDJSONRequestBody
	if err := c.ShouldBindJSON(&body); err != nil {
		s.handleCommonServiceErrors(c, services.ErrInvalidInput)
		return
	}
	order, err := s.orders.UpdateOrder(c.Request.Context(), orderservice.UpdateInput{
		StoreID: storeID, OrderID: orderID, Status: domain.OrderStatus(body.Status), ExpectedVersion: body.ExpectedVersion,
	})
	if err != nil {
		messages := CommonErrorMessages{NotFound: "店舗または注文が見つかりません"}
		switch {
		case errors.Is(err, orderservice.ErrOrderVersionConflict):
			messages.Conflict = "注文が更新されています。再読み込みしてください"
		case errors.Is(err, orderservice.ErrOrderStateConflict):
			messages.Conflict = "注文の状態を変更できません"
		case errors.Is(err, orderservice.ErrCancelTooEarly):
			messages.Conflict = "呼び出し開始から15分が経過するまでキャンセルできません"
		}
		s.handleCommonServiceErrors(c, err, messages)
		return
	}
	c.JSON(http.StatusOK, toOrderResponse(order))
}

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
