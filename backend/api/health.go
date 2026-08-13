package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (s *Server) GetHealth(c *gin.Context) {
	c.JSON(http.StatusOK, HealthResponse{Status: "ok"})
}
