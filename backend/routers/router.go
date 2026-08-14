package routers

import (
	"fmt"
	"net/http"
	"time"

	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	ginmiddleware "github.com/oapi-codegen/gin-middleware"
)

func NewRouter(s *Server, corsAllowedOrigins []string) (*gin.Engine, error) {
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

	openAPIValidator, err := newOpenAPIRequestValidator()
	if err != nil {
		return nil, err
	}

	openAPIRoutes := router.Group("")
	openAPIRoutes.Use(limitRequestBody(maxRequestBodySize))
	openAPIRoutes.Use(openAPIValidator)
	RegisterHandlers(openAPIRoutes, s)

	// OAuth のログイン・コールバックは OpenAPI の管理対象外なので、
	// OpenAPI 検証 Middleware を適用しない。
	RegisterAuthRoutes(router, s)

	return router, nil
}

func limitRequestBody(maxBytes int64) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.ContentLength > maxBytes {
			c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, ErrorResponse{
				Message: "リクエストが大きすぎます",
			})
			return
		}

		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
		c.Next()
	}
}

func newOpenAPIRequestValidator() (gin.HandlerFunc, error) {
	swagger, err := GetSwagger()
	if err != nil {
		return nil, fmt.Errorf("load OpenAPI specification: %w", err)
	}

	// 環境ごとの Host に依存せず、パスとリクエスト内容を検証する。
	swagger.Servers = nil

	return ginmiddleware.OapiRequestValidatorWithOptions(
		swagger,
		&ginmiddleware.Options{
			Options: openapi3filter.Options{
				// 認証・認可は Service 層で検証する。
				AuthenticationFunc: openapi3filter.NoopAuthenticationFunc,
			},
			ErrorHandler: func(c *gin.Context, _ string, statusCode int) {
				c.AbortWithStatusJSON(statusCode, ErrorResponse{
					Message: "リクエスト形式が不正です",
				})
			},
		},
	), nil
}
