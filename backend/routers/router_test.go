package routers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

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
			request := httptest.NewRequest(http.MethodOptions, "/health", nil)
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
	request := httptest.NewRequest(http.MethodOptions, "/health", nil)
	request.Header.Set("Origin", "https://example.com")
	request.Header.Set("Access-Control-Request-Method", http.MethodGet)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if got := response.Header().Get("Access-Control-Allow-Origin"); got != "" {
		t.Errorf("Access-Control-Allow-Origin = %q, want empty", got)
	}
}

func TestOpenAPIRequestValidatorAcceptsValidRequest(t *testing.T) {
	validator, err := newOpenAPIRequestValidator()
	if err != nil {
		t.Fatalf("newOpenAPIRequestValidator() error = %v", err)
	}

	router := gin.New()
	router.GET("/health", validator, func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodGet, "/health", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", response.Code, http.StatusNoContent)
	}
}

func TestOpenAPIRequestValidatorDelegatesAuthentication(t *testing.T) {
	validator, err := newOpenAPIRequestValidator()
	if err != nil {
		t.Fatalf("newOpenAPIRequestValidator() error = %v", err)
	}

	router := gin.New()
	router.GET("/me", validator, func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodGet, "/me", nil)
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", response.Code, http.StatusNoContent)
	}
}

func TestOpenAPIRequestValidatorRejectsInvalidRequest(t *testing.T) {
	validator, err := newOpenAPIRequestValidator()
	if err != nil {
		t.Fatalf("newOpenAPIRequestValidator() error = %v", err)
	}

	router := gin.New()
	handlerCalled := false
	router.POST("/store-applications", validator, func(c *gin.Context) {
		handlerCalled = true
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(
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
}

func TestLimitRequestBodyRejectsOversizedBody(t *testing.T) {
	router := gin.New()
	handlerCalled := false
	router.POST("/", limitRequestBody(4), func(c *gin.Context) {
		handlerCalled = true
		c.Status(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodPost, "/", strings.NewReader("12345"))
	response := httptest.NewRecorder()

	router.ServeHTTP(response, request)

	if response.Code != http.StatusRequestEntityTooLarge {
		t.Errorf("status = %d, want %d", response.Code, http.StatusRequestEntityTooLarge)
	}
	if handlerCalled {
		t.Error("handler was called for an oversized request body")
	}
}
