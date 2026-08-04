package api

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/isc-makeit/isc-fes/backend/internal/service"
)

func (s *Server) CreateStoreApplication(c *gin.Context) {

}

func writeAPIErrorResponse(c *gin.Context, err error) {
	switch {
	case errors.Is(err, service.ErrAccountAlreadyHasStore):
		c.JSON(http.StatusConflict, ErrorResponse{Message: "アカウントはすでに店舗に所属しています。"})
	}
}
