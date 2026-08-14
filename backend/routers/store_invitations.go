package routers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

func (s *Server) CreateStoreInvitation(c *gin.Context, storeID uuid.UUID) {
	var body CreateStoreInvitationJSONBody
	if err := c.ShouldBindJSON(&body); err != nil {
		s.handleCommonServiceErrors(c, errors.New("Middleware で検証しているはずの値のシリアライズに失敗"))
		return
	}

	inv, err := s.storeInvitation.CreateStoreInvitation(c.Request.Context(), storeID, entities.StoreMemberRole(body.Role), body.MaxUses)
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusCreated, CreateStoreInvitationResponse{
		Id:        inv.ID,
		StoreId:   inv.StoreID,
		MaxUses:   inv.MaxUses,
		Role:      StoreMemberRole(inv.Role),
		CreatedAt: inv.CreatedAt,
	})
}
