package routers

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/services"
	ginmiddleware "github.com/oapi-codegen/gin-middleware"
)

const accountSessionSecurityScheme = "AccountSession"

const authenticationErrorContextKey = "openapi-authentication-error"

type currentAccountLoader interface {
	GetCurrentAccount(ctx context.Context) (entities.Account, error)
}

type authenticationErrorHandler func(c *gin.Context, err error)

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

	openAPIValidator, err := newOpenAPIRequestValidator(
		s.accountService,
		func(c *gin.Context, err error) {
			s.handleCommonServiceErrors(c, err)
		},
	)
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

func newOpenAPIRequestValidator(
	accountLoader currentAccountLoader,
	handleAuthenticationError authenticationErrorHandler,
) (gin.HandlerFunc, error) {
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
				AuthenticationFunc: authenticateAccountSession(accountLoader),
			},
			ErrorHandler: func(c *gin.Context, _ string, statusCode int) {
				if authenticationError, ok := c.Get(authenticationErrorContextKey); ok {
					handleAuthenticationError(c, authenticationError.(error))
					return
				}

				c.AbortWithStatusJSON(statusCode, ErrorResponse{
					Message: "リクエスト形式が不正です",
				})
			},
		},
	), nil
}

func authenticateAccountSession(accountLoader currentAccountLoader) openapi3filter.AuthenticationFunc {
	return func(ctx context.Context, input *openapi3filter.AuthenticationInput) error {
		if input.SecuritySchemeName != accountSessionSecurityScheme {
			return input.NewError(fmt.Errorf("unsupported security scheme: %s", input.SecuritySchemeName))
		}

		ginContext := ginmiddleware.GetGinContext(ctx)
		if ginContext == nil {
			return input.NewError(fmt.Errorf("get Gin context for authentication"))
		}

		request := input.RequestValidationInput.Request
		account, err := accountLoader.GetCurrentAccount(request.Context())
		if err != nil {
			ginContext.Set(authenticationErrorContextKey, err)
			return input.NewError(err)
		}

		request = request.WithContext(services.WithAuthenticatedAccount(request.Context(), account))
		input.RequestValidationInput.Request = request
		ginContext.Request = request

		return nil
	}
}
