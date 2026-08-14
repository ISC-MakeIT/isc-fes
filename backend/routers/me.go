package routers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/isc-makeit/isc-fes/backend/services"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

func (s *Server) GetMe(c *gin.Context) {
	ctx := c.Request.Context()

	account, err := services.RequireAuthenticatedAccount(ctx)
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusOK, MeResponse{
		Id:          openapi_types.UUID(account.ID),
		Email:       openapi_types.Email(account.Email),
		DisplayName: account.DisplayName,
		PictureUrl:  account.PictureURL,
		Role:        MeResponseRole(account.Role),
	})
}
