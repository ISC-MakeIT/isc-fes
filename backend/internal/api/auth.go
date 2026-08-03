package api

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/isc-makeit/isc-fes/backend/internal/service"
)

// OpenAPI 定義外の認証系のルートを登録する
func RegisterAuthRoutes(router gin.IRoutes, server *Server) {
	router.GET("/auth/google/login", server.googleLogin)
	router.GET("/auth/google/callback", server.googleCallback)
}

func (s *Server) googleLogin(c *gin.Context) {
	loginURL, err := s.auth.StartGoogleLogin(c.Request.Context())
	if err != nil {
		log.Printf("start Google login: %v", err)

		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"message": "failed to start login",
		})
		return
	}

	c.Redirect(http.StatusFound, loginURL)
}

func (s *Server) googleCallback(c *gin.Context) {
	ctx := c.Request.Context()
	input := service.CompleteLoginInput{
		Code:          c.Query("code"),
		State:         c.Query("state"),
		ProviderError: c.Query("error"),
	}

	err := s.auth.CompleteGoogleLogin(ctx, input)
	if err != nil {
		log.Printf("complete Google login: %v", err)
		// TODO: 全部が Internal Error にならないようにする
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"message": "failed to complete login",
		})
		return
	}

	c.Redirect(http.StatusFound, s.frontendURL)
}
