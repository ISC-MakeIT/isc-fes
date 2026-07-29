package api

import (
	"crypto/subtle"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	db "github.com/isc-makeit/isc-fes/backend/internal/db/sqlc"
)

// OpenAPI 定義外の認証系のルートを登録する
func RegisterAuthRoutes(router gin.IRoutes, server *Server) {
	router.GET("/auth/google/login", server.googleLogin)
	router.GET("/auth/google/callback", server.googleCallback)
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

func (s *Server) googleCallback(c *gin.Context) {
	ctx := c.Request.Context()

	// OAuthFlowは成功・失敗にかかわらず単回使用にする。
	flow, err := s.sessions.PopOAuth(ctx)
	if err != nil {
		log.Printf("pop Google OAuth flow: %v", err)

		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"message": "invalid or expired login flow",
		})
		return
	}

	receivedState := c.Query("state")
	if subtle.ConstantTimeCompare(
		[]byte(receivedState),
		[]byte(flow.State),
	) != 1 {
		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"message": "invalid OAuth state",
		})
		return
	}

	// ユーザーがGoogleログインをキャンセルした場合など。
	if providerError := c.Query("error"); providerError != "" {
		log.Printf("Google OAuth returned error: %s", providerError)

		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"message": "Google login was cancelled or rejected",
		})
		return
	}

	identity, err := s.googleAuthenticator.ExchangeAndVerify(
		ctx,
		c.Query("code"),
		flow.PKCEVerifier,
		flow.Nonce,
	)
	if err != nil {
		log.Printf("verify Google callback: %v", err)

		c.AbortWithStatusJSON(http.StatusBadRequest, gin.H{
			"message": "failed to verify Google login",
		})
		return
	}

	var pictureURL *string
	if identity.PictureURL != "" {
		pictureURL = &identity.PictureURL
	}

	account, err := s.queries.UpsertAccount(
		ctx,
		db.UpsertAccountParams{
			GoogleSub:   identity.Subject,
			Email:       identity.Email,
			DisplayName: identity.DisplayName,
			PictureUrl:  pictureURL,
		},
	)
	if err != nil {
		log.Printf("upsert Google account: %v", err)

		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"message": "failed to save account",
		})
		return
	}

	if err := s.sessions.SignIn(ctx, account.ID); err != nil {
		log.Printf("create account session: %v", err)

		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"message": "failed to create login session",
		})
		return
	}

	c.Redirect(http.StatusFound, s.frontendURL)
}
