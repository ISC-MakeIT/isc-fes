package routers

import (
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/isc-makeit/isc-fes/backend/services"
)

// OpenAPI 定義外の認証系のルートを登録する
func RegisterAuthRoutes(router gin.IRoutes, server *Server) {
	router.GET("/auth/google/login", server.googleLogin)
	router.GET("/auth/google/callback", server.googleCallback)
}

func (s *Server) googleLogin(c *gin.Context) {
	loginURL, err := s.auth.StartGoogleLogin(
		c.Request.Context(),
		services.StartGoogleLoginInput{
			RedirectTo: c.Query("redirect_to"),
		},
	)
	if err != nil {
		captureUnexpectedError(c, fmt.Errorf("start Google login: %w", err))

		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"message": "failed to start login",
		})
		return
	}

	c.Redirect(http.StatusFound, loginURL)
}

func (s *Server) googleCallback(c *gin.Context) {
	ctx := c.Request.Context()
	input := services.CompleteLoginInput{
		Code:          c.Query("code"),
		State:         c.Query("state"),
		ProviderError: c.Query("error"),
	}

	output, err := s.auth.CompleteGoogleLogin(ctx, input)
	if err != nil {
		captureUnexpectedError(c, fmt.Errorf("complete Google login: %w", err))
		// TODO: 全部が Internal Error にならないようにする
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"message": "failed to complete login",
		})
		return
	}

	redirectURL, err := frontendRedirectURL(s.frontendURL, output.RedirectTo)
	if err != nil {
		captureUnexpectedError(c, fmt.Errorf("resolve frontend redirect URL: %w", err))
		c.AbortWithStatusJSON(http.StatusInternalServerError, gin.H{
			"message": "failed to complete login",
		})
		return
	}

	c.Redirect(http.StatusFound, redirectURL)
}

func frontendRedirectURL(frontendURL, redirectTo string) (string, error) {
	base, err := url.Parse(frontendURL)
	if err != nil || base.Scheme == "" || base.Host == "" ||
		(base.Scheme != "http" && base.Scheme != "https") ||
		base.User != nil || base.Opaque != "" {
		return "", fmt.Errorf("invalid FRONTEND_URL")
	}

	root := *base
	root.Path = "/"
	root.RawPath = ""
	root.RawQuery = ""
	root.Fragment = ""

	relative, err := url.Parse(redirectTo)
	if err != nil {
		return root.String(), nil
	}
	if _, err := url.QueryUnescape(relative.RawQuery); err != nil {
		return root.String(), nil
	}

	resolved := root.ResolveReference(relative)
	if !strings.EqualFold(resolved.Scheme, root.Scheme) ||
		!strings.EqualFold(resolved.Host, root.Host) {
		return root.String(), nil
	}

	return resolved.String(), nil
}
