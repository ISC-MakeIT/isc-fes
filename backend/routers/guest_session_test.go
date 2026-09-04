package routers

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestResolveRequiredGuestSessionSkipsUnmarkedRequest(t *testing.T) {
	gin.SetMode(gin.TestMode)
	guestResolver := &stubGuestResolver{}
	middleware := resolveRequiredGuestSession(guestResolver, func(c *gin.Context, _ error) {
		c.Status(http.StatusInternalServerError)
	})

	router := gin.New()
	router.Use(middleware)
	router.GET("/stores", func(c *gin.Context) {
		c.Status(http.StatusNoContent)
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/stores", nil)
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusNoContent {
		t.Errorf("status = %d, want %d", recorder.Code, http.StatusNoContent)
	}
	if guestResolver.calls != 0 {
		t.Errorf("ResolveOrCreateGuest() calls = %d, want 0", guestResolver.calls)
	}
}

func TestResolveRequiredGuestSessionStopsRequestWhenIssuanceFails(t *testing.T) {
	gin.SetMode(gin.TestMode)
	wantErr := errors.New("database unavailable")
	guestResolver := &stubGuestResolver{err: wantErr}
	middleware := resolveRequiredGuestSession(guestResolver, func(c *gin.Context, err error) {
		if !errors.Is(err, wantErr) {
			t.Errorf("handleError() error = %v, want %v", err, wantErr)
		}
		c.Status(http.StatusInternalServerError)
	})

	handlerCalled := false
	router := gin.New()
	router.Use(func(c *gin.Context) {
		c.Set(guestSessionRequiredContextKey, true)
	})
	router.Use(middleware)
	router.PUT("/stores/:store_id/cart", func(c *gin.Context) {
		handlerCalled = true
	})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequestWithContext(t.Context(), http.MethodPut, "/stores/store-id/cart", nil)
	router.ServeHTTP(recorder, request)

	if recorder.Code != http.StatusInternalServerError {
		t.Errorf("status = %d, want %d", recorder.Code, http.StatusInternalServerError)
	}
	if handlerCalled {
		t.Error("handler was called when Guest issuance failed")
	}
}
