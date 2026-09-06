package routers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	menu_service "github.com/isc-makeit/isc-fes/backend/services/store/menus"
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

func (s *Server) CreateMenu(c *gin.Context, storeID uuid.UUID) {
	ctx := c.Request.Context()

	var body CreateMenuInput
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Message: "リクエスト形式が不正です。",
		})
		return
	}

	var toppingIDs []uuid.UUID
	if body.ToppingIds != nil {
		toppingIDs = *body.ToppingIds
	}

	menu, err := s.menu.CreateMenu(ctx, storeID, menu_service.CreateMenuInput{
		Name:           body.Name,
		Description:    body.Description,
		UnitPrice:      body.UnitPrice,
		ToppingIds:     toppingIDs,
		ImageObjectKey: menus.MenuImageObjectKey(body.ImageObjectKey),
	})
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusCreated, toMenu(menu))
}

func (s *Server) UpdateMenuByStoreIDAndMenuID(c *gin.Context, storeID uuid.UUID, menuID uuid.UUID) {
	ctx := c.Request.Context()

	var body UpdateMenuInput
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Message: "リクエスト形式が不正です。",
		})
		return
	}

	var toppingIDs []uuid.UUID
	if body.ToppingIds != nil {
		toppingIDs = *body.ToppingIds
	}
	var imageObjectKey *menus.MenuImageObjectKey
	if body.ImageObjectKey != nil {
		key := menus.MenuImageObjectKey(*body.ImageObjectKey)
		imageObjectKey = &key
	}

	m, err := s.menu.UpdateMenuByStoreIDAndMenuID(ctx, storeID, menuID, menu_service.UpdateMenuInput{
		Name:           body.Name,
		Description:    body.Description,
		UnitPrice:      body.UnitPrice,
		ToppingIds:     toppingIDs,
		ImageObjectKey: imageObjectKey,
	})
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusOK, toMenu(m))
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

func (s *Server) DeleteMenuByStoreIDAndMenuID(c *gin.Context, storeID uuid.UUID, menuID uuid.UUID) {
	ctx := c.Request.Context()

	err := s.menu.DeleteMenuByStoreIDAndMenuID(ctx, storeID, menuID)
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusNoContent, nil)
}
