package routers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/isc-makeit/isc-fes/backend/buildinfo"
)

func (s *Server) GetHealth(c *gin.Context) {
	c.JSON(http.StatusOK, HealthResponse{
		Status:     "ok",
		CommitHash: buildinfo.CommitHash,
		DeployedAt: buildinfo.DeploymentTime(),
	})
}
