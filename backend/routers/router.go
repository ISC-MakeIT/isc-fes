package routers

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/getkin/kin-openapi/openapi3filter"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/services"
	ginmiddleware "github.com/oapi-codegen/gin-middleware"
)

const (
	accountSessionSecurityScheme = "AccountSession"
	guestSessionSecurityScheme   = "GuestSession"
)

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

	handleAuthenticationError := func(c *gin.Context, err error) {
		s.handleCommonServiceErrors(c, err)
	}
	openAPIValidator, err := newOpenAPIRequestValidator(
		s.accountService,
		handleAuthenticationError,
	)
	if err != nil {
		return nil, err
	}

	openAPIRoutes := router.Group("")
	openAPIRoutes.Use(limitRequestBody(maxRequestBodySize))
	openAPIRoutes.Use(openAPIValidator)
	openAPIRoutes.Use(resolveRequiredGuestSession(s.guestResolver, handleAuthenticationError))
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

		if c.Request.ContentLength < 0 {
			limitedBody := http.MaxBytesReader(c.Writer, c.Request.Body, maxBytes)
			body, err := io.ReadAll(limitedBody)
			closeErr := limitedBody.Close()
			if err == nil {
				err = closeErr
			}

			var maxBytesError *http.MaxBytesError
			if errors.As(err, &maxBytesError) {
				c.AbortWithStatusJSON(http.StatusRequestEntityTooLarge, ErrorResponse{
					Message: "リクエストが大きすぎます",
				})
				return
			}
			if err != nil {
				c.AbortWithStatusJSON(http.StatusBadRequest, ErrorResponse{
					Message: "リクエスト本文を読み込めません",
				})
				return
			}

			c.Request.ContentLength = int64(len(body))
			c.Request.GetBody = func() (io.ReadCloser, error) {
				return io.NopCloser(bytes.NewReader(body)), nil
			}
			c.Request.Body, _ = c.Request.GetBody()
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

	return openAPIRequestValidator(swagger, accountLoader, handleAuthenticationError), nil
}

func openAPIRequestValidator(
	swagger *openapi3.T,
	accountLoader currentAccountLoader,
	handleAuthenticationError authenticationErrorHandler,
) gin.HandlerFunc {
	// 環境ごとの Host に依存せず、パスとリクエスト内容を検証する。
	swagger.Servers = nil

	return ginmiddleware.OapiRequestValidatorWithOptions(
		swagger,
		&ginmiddleware.Options{
			Options: openapi3filter.Options{
				AuthenticationFunc: authenticateSession(accountLoader),
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
	)
}

func authenticateSession(accountLoader currentAccountLoader) openapi3filter.AuthenticationFunc {
	return func(ctx context.Context, input *openapi3filter.AuthenticationInput) error {
		ginContext := ginmiddleware.GetGinContext(ctx)
		if ginContext == nil {
			return input.NewError(fmt.Errorf("get Gin context for authentication"))
		}

		request := input.RequestValidationInput.Request

		switch input.SecuritySchemeName {
		case accountSessionSecurityScheme:
			account, err := accountLoader.GetCurrentAccount(request.Context())
			if err != nil {
				ginContext.Set(authenticationErrorContextKey, err)
				return input.NewError(err)
			}

			request = request.WithContext(
				services.WithAuthenticatedAccount(request.Context(), account),
			)
		case guestSessionSecurityScheme:
			// Guestは未発行でも認証成功とし、OpenAPI検証後のMiddlewareで発行する。
			// ここで発行すると、不正なrequest bodyでもGuestが作成されてしまう。
			ginContext.Set(guestSessionRequiredContextKey, true)
		default:
			return input.NewError(
				fmt.Errorf("unsupported security scheme: %s", input.SecuritySchemeName),
			)
		}

		input.RequestValidationInput.Request = request
		ginContext.Request = request

		return nil
	}
}
