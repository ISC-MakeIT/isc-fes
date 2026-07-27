package api

import (
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
)

// OpenAPI 定義外の認証系のルートを登録する
func RegisterAuthRoutes(router gin.IRoutes, server *Server) {
	router.GET("/auth/google/login", server.googleLogin)
}

func (s *Server) googleLogin(c *gin.Context) {
	flow, err := s.sessions.BeginOAuth(c.Request.Context())
	if err != nil {
		log.Printf("begin Google OAuth: %v", err)

		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"message": "failed to start login",
		})
		return
	}

	loginURL := s.googleAuthenticator.LoginURL(flow)

	c.Redirect(http.StatusFound, loginURL)
}
