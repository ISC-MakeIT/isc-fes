package routers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/toppings"
	toppings_service "github.com/isc-makeit/isc-fes/backend/services/store/toppings"
	"github.com/isc-makeit/isc-fes/backend/utils"
)

func (s *Server) GetToppingsByStoreID(c *gin.Context, storeID uuid.UUID) {
	toppings, err := s.toppings.GetToppingsByStoreID(c.Request.Context(), storeID)
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusOK, GetToppingsByStoreIDResponse{
		Total: len(toppings),
		Data:  utils.Map(toppings, toToppingResponse),
	})
}

func (s *Server) CreateTopping(c *gin.Context, storeID uuid.UUID) {
	var input CreateToppingJSONRequestBody
	if err := c.ShouldBindJSON(&input); err != nil {
		s.handleCommonServiceErrors(c, fmt.Errorf("middleware で検証しているはずの、ボディのシリアライズに失敗: %w", err))
		return
	}

	topping, err := s.toppings.CreateTopping(c.Request.Context(), toppings_service.CreateToppingInput{
		StoreID:   storeID,
		Name:      input.Name,
		UnitPrice: input.UnitPrice,
	})
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusCreated, toToppingResponse(topping))
}

func toToppingResponse(t toppings.Topping) Topping {
	return Topping{
		Id:        t.ID,
		StoreId:   t.StoreID,
		Name:      t.Name,
		UnitPrice: t.UnitPrice,
		SoldOut:   t.SoldOut,
		UpdatedAt: t.UpdatedAt,
		CreatedAt: t.CreatedAt,
	}
}
