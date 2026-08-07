package api

import (
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func NewRouter(s *Server, corsAllowedOrigins []string) *gin.Engine {
	router := gin.New()

	// URL の Query がログに出ないようになる。/callback などで code, state などが出ないように
	router.Use(gin.LoggerWithConfig(gin.LoggerConfig{SkipQueryString: true}))

	router.Use(gin.Recovery())

	router.Use(cors.New(cors.Config{
		AllowOrigins: corsAllowedOrigins,
		AllowMethods: []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodPatch,
			http.MethodDelete,
			http.MethodOptions,
		},
		AllowHeaders: []string{
			"Origin",
			"Content-Type",
			"Accept",
		},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	RegisterHandlers(router, s)
	RegisterAuthRoutes(router, s)

	return router
}
