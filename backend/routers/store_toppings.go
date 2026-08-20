package routers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/toppings"
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

func toToppingResponse(t toppings.Topping) Topping {
	return Topping{
		Id:          t.ID,
		StoreId:     t.StoreID,
		Name:        t.Name,
		Description: t.Description,
		UnitPrice:   t.UnitPrice,
		SoldOut:     t.SoldOut,
		UpdatedAt:   t.UpdatedAt,
		CreatedAt:   t.CreatedAt,
	}
}
