package routers

import (
	"context"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/getkin/kin-openapi/openapi3"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/services"
)

type stubCurrentAccountLoader struct {
	account entities.Account
	err     error
	calls   int
}

type stubGuestResolver struct {
	guestID uuid.UUID
	err     error
	calls   int
}

func (s *stubGuestResolver) ResolveOrCreateGuest(context.Context) (uuid.UUID, error) {
	s.calls++
	return s.guestID, s.err
}

func (s *stubCurrentAccountLoader) GetCurrentAccount(context.Context) (entities.Account, error) {
	s.calls++
	return s.account, s.err
}

func mustOpenAPIRequestValidator(
	t *testing.T,
	accountLoader currentAccountLoader,
) gin.HandlerFunc {
	t.Helper()

	validator, err := newOpenAPIRequestValidator(
		accountLoader,
		handleTestAuthenticationError,
	)
	if err != nil {
		t.Fatalf("newOpenAPIRequestValidator() error = %v", err)
	}

	return validator
}

func handleTestAuthenticationError(c *gin.Context, err error) {
	if errors.Is(err, services.ErrUnauthenticated) {
		c.AbortWithStatusJSON(http.StatusUnauthorized, ErrorResponse{
			Message: "未ログインです",
		})
		return
	}

	c.AbortWithStatusJSON(http.StatusInternalServerError, ErrorResponse{
		Message: "サーバー内部でエラーが発生しました",
	})
}

func guestSessionSecurityRequirement() *openapi3.SecurityRequirements {
	requirements := openapi3.SecurityRequirements{
		openapi3.SecurityRequirement{guestSessionSecurityScheme: []string{}},
	}
	return &requirements
}

func TestOpenAPIRequestValidatorResolvesGuestForGuestSessionOperation(t *testing.T) {
	gin.SetMode(gin.TestMode)
	want := uuid.New()
	guestResolver := &stubGuestResolver{guestID: want}

	swagger, err := GetSwagger()
	if err != nil {
		t.Fatalf("GetSwagger() error = %v", err)
	}
	swagger.Paths.Find("/health").Get.Security = guestSessionSecurityRequirement()

	router := gin.New()
	router.GET(
		"/health",
		openAPIRequestValidator(swagger, &stubCurrentAccountLoader{}, handleTestAuthenticationError),
		resolveRequiredGuestSession(guestResolver, handleTestAuthenticationError),
		func(c *gin.Context) {
			got, err := services.RequireGuest(c.Request.Context())
			if err != nil {
				t.Errorf("RequireGuest() error = %v", err)
				c.Status(http.StatusInternalServerError)
				return
			}
			if got != want {
				t.Errorf("RequireGuest() = %v, want %v", got, want)
				c.Status(http.StatusInternalServerError)
				return
			}

			c.Status(http.StatusNoContent)
		},
	)

	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/health", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", response.Code, http.StatusNoContent)
	}
	if guestResolver.calls != 1 {
		t.Errorf("ResolveOrCreateGuest() calls = %d, want 1", guestResolver.calls)
	}
}

func TestRouterCORSAllowedOrigins(t *testing.T) {
	allowedOrigins := []string{
		"http://localhost:3000",
		"http://localhost:8082",
	}
	router, err := NewRouter(&Server{}, allowedOrigins)
	if err != nil {
		t.Fatalf("NewRouter() error = %v", err)
	}

	for _, origin := range allowedOrigins {
		t.Run(origin, func(t *testing.T) {
			request := httptest.NewRequestWithContext(t.Context(), http.MethodOptions, "/health", nil)
			request.Header.Set("Origin", origin)
			request.Header.Set("Access-Control-Request-Method", http.MethodPut)
			response := httptest.NewRecorder()

			router.ServeHTTP(response, request)

			if response.Code != http.StatusNoContent {
				t.Errorf("status = %d, want %d", response.Code, http.StatusNoContent)
			}
			if got := response.Header().Get("Access-Control-Allow-Origin"); got != origin {
				t.Errorf("Access-Control-Allow-Origin = %q, want %q", got, origin)
			}
		})
	}
}

func TestRouterCORSRejectsUnknownOrigin(t *testing.T) {
	router, err := NewRouter(&Server{}, []string{"http://localhost:3000"})
	if err != nil {
		t.Fatalf("NewRouter() error = %v", err)
	}
	request := httptest.NewRequestWithContext(t.Context(), http.MethodOptions, "/health", nil)
	request.Header.Set("Origin", "https://example.com")
	request.Header.Set("Access-Control-Request-Method", http.MethodGet)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if got := response.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Access-Control-Allow-Origin = %q, want empty", got)
	}
}

func TestOpenAPIRequestValidatorAcceptsValidRequest(t *testing.T) {
	accountLoader := &stubCurrentAccountLoader{}
	validator := mustOpenAPIRequestValidator(t, accountLoader)

	router := gin.New()
	router.GET("/health", validator, func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/health", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", response.Code, http.StatusNoContent)
	}
	if accountLoader.calls != 0 {
		t.Errorf("GetCurrentAccount() calls = %d, want 0", accountLoader.calls)
	}
}

func TestOpenAPIRequestValidatorStoresAuthenticatedAccount(t *testing.T) {
	want := entities.Account{ID: uuid.New()}
	accountLoader := &stubCurrentAccountLoader{account: want}
	validator := mustOpenAPIRequestValidator(t, accountLoader)

	router := gin.New()
	router.GET("/me", validator, func(c *gin.Context) {
		got, err := services.RequireAuthenticatedAccount(c.Request.Context())
		if err != nil {
			t.Error("authenticated account was not stored in request context")
			c.Status(http.StatusInternalServerError)
			return
		}
		if got.ID != want.ID {
			t.Errorf("account ID = %s, want %s", got.ID, want.ID)
			c.Status(http.StatusInternalServerError)
			return
		}

		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/me", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", response.Code, http.StatusNoContent)
	}
	if accountLoader.calls != 1 {
		t.Errorf("GetCurrentAccount() calls = %d, want 1", accountLoader.calls)
	}
}

func TestOpenAPIRequestValidatorRejectsUnauthenticatedRequest(t *testing.T) {
	accountLoader := &stubCurrentAccountLoader{err: services.ErrUnauthenticated}
	validator := mustOpenAPIRequestValidator(t, accountLoader)

	router := gin.New()
	handlerCalled := false
	router.GET("/me", validator, func(c *gin.Context) {
		handlerCalled = true
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/me", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusUnauthorized {
		t.Errorf("status = %d, want %d", response.Code, http.StatusUnauthorized)
	}
	if handlerCalled {
		t.Error("handler was called for an unauthenticated request")
	}
}

func TestOpenAPIRequestValidatorReturnsInternalServerErrorOnAccountLoadFailure(t *testing.T) {
	accountLoader := &stubCurrentAccountLoader{err: errors.New("database unavailable")}
	validator := mustOpenAPIRequestValidator(t, accountLoader)

	router := gin.New()
	handlerCalled := false
	router.GET("/me", validator, func(c *gin.Context) {
		handlerCalled = true
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/me", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d", response.Code, http.StatusInternalServerError)
	}
	if handlerCalled {
		t.Error("handler was called when loading the account failed")
	}
}

func TestOpenAPIRequestValidatorRejectsInvalidRequest(t *testing.T) {
	swagger, err := GetSwagger()
	if err != nil {
		t.Fatalf("GetSwagger() error = %v", err)
	}
	swagger.Paths.Find("/store-applications").Post.Security = guestSessionSecurityRequirement()
	validator := openAPIRequestValidator(
		swagger,
		&stubCurrentAccountLoader{},
		handleTestAuthenticationError,
	)
	guestResolver := &stubGuestResolver{}

	router := gin.New()
	handlerCalled := false
	router.POST(
		"/store-applications",
		validator,
		resolveRequiredGuestSession(guestResolver, handleTestAuthenticationError),
		func(c *gin.Context) {
			handlerCalled = true
			c.Status(http.StatusNoContent)
		},
	)

	request := httptest.NewRequestWithContext(
		t.Context(),
		http.MethodPost,
		"/store-applications",
		strings.NewReader(`{"name":"test"}`),
	)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusBadRequest {
		t.Errorf("status = %d, want %d", response.Code, http.StatusBadRequest)
	}
	if handlerCalled {
		t.Error("handler was called for an invalid OpenAPI request")
	}
	if guestResolver.calls != 0 {
		t.Errorf("ResolveOrCreateGuest() calls = %d, want 0", guestResolver.calls)
	}
}

func TestOpenAPIRequestValidatorValidatesStoreMemberRole(t *testing.T) {
	tests := []struct {
		name       string
		role       string
		wantStatus int
	}{
		{name: "staff is accepted", role: "staff", wantStatus: http.StatusNoContent},
		{name: "legacy member is rejected", role: "member", wantStatus: http.StatusBadRequest},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			validator := mustOpenAPIRequestValidator(t, &stubCurrentAccountLoader{})
			router := gin.New()
			router.POST("/stores/:store_id/invitations", validator, func(c *gin.Context) {
				c.Status(http.StatusNoContent)
			})

			request := httptest.NewRequestWithContext(
				t.Context(),
				http.MethodPost,
				"/stores/00000000-0000-0000-0000-000000000000/invitations",
				strings.NewReader(`{"role":"`+test.role+`"}`),
			)
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()

			router.ServeHTTP(response, request)

			if response.Code != test.wantStatus {
				t.Errorf("status = %d, want %d", response.Code, test.wantStatus)
			}
		})
	}
}

func TestLimitRequestBodyRejectsOversizedBody(t *testing.T) {
	router := gin.New()
	handlerCalled := false
	router.POST("/", limitRequestBody(4), func(c *gin.Context) {
		handlerCalled = true
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/", strings.NewReader("12345"))
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("status = %d, want %d", response.Code, http.StatusRequestEntityTooLarge)
	}
	if handlerCalled {
		t.Error("handler was called for an oversized request body")
	}
}

func TestLimitRequestBodyRejectsOversizedBodyWithUnknownLength(t *testing.T) {
	router := gin.New()
	handlerCalled := false
	router.POST("/", limitRequestBody(4), func(c *gin.Context) {
		handlerCalled = true
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequestWithContext(
		t.Context(),
		http.MethodPost,
		"/",
		io.NopCloser(strings.NewReader("12345")),
	)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("status = %d, want %d", response.Code, http.StatusRequestEntityTooLarge)
	}
	if handlerCalled {
		t.Error("handler was called for an oversized request body with unknown length")
	}
}

func TestLimitRequestBodyRestoresBodyWithUnknownLength(t *testing.T) {
	router := gin.New()
	const wantBody = "1234"
	router.POST("/", limitRequestBody(4), func(c *gin.Context) {
		body, err := io.ReadAll(c.Request.Body)
		if err != nil {
			t.Errorf("ReadAll() error = %v", err)
			c.Status(http.StatusInternalServerError)
			return
		}
		if string(body) != wantBody {
			t.Errorf("body = %q, want %q", body, wantBody)
			c.Status(http.StatusInternalServerError)
			return
		}

		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequestWithContext(
		t.Context(),
		http.MethodPost,
		"/",
		io.NopCloser(strings.NewReader(wantBody)),
	)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", response.Code, http.StatusNoContent)
	}
}
