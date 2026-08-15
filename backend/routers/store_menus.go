package routers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/isc-makeit/isc-fes/backend/utils"
)

func (s *Server) GetMenusByStoreID(c *gin.Context, storeID uuid.UUID) {
	menus, err := s.menu.GetMenusByStoreID(c.Request.Context(), storeID)
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusOK, GetMenusByStoreIDResponse{
		Total: len(menus),
		Data:  utils.Map(menus, toMenu),
	})
}

func toMenu(menuDisplay menus.MenuDisplay) Menu {
	return Menu{
		Id:          menuDisplay.ID,
		StoreId:     menuDisplay.StoreID,
		Name:        menuDisplay.Name,
		Description: menuDisplay.Description,
		UnitPrice:   menuDisplay.UnitPrice,
		ImageUrl:    menuDisplay.ImageURL,
		SoldOut:     menuDisplay.SoldOut,
		UpdatedAt:   menuDisplay.UpdatedAt,
		CreatedAt:   menuDisplay.CreatedAt,
	}
}
