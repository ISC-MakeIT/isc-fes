package routers

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/services"
)

func TestResolveOptionalStoreAccount(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, path := range []string{"/stores/:store_id", "/stores/:store_id/menus", "/stores/:store_id/menus/:menu_id/toppings"} {
		for _, test := range []struct {
			name   string
			err    error
			status int
		}{
			{"admin", nil, http.StatusOK},
			{"anonymous", services.ErrUnauthenticated, http.StatusOK},
			{"account lookup failure", errors.New("database unavailable"), http.StatusInternalServerError},
		} {
			t.Run(path+"/"+test.name, func(t *testing.T) {
				loader := &stubCurrentAccountLoader{account: entities.Account{Role: entities.RoleAdmin}, err: test.err}
				router := gin.New()
				router.Use(resolveOptionalStoreAccount(loader, handleTestAuthenticationError))
				router.GET(path, func(c *gin.Context) {
					account, err := services.RequireAuthenticatedAccount(c.Request.Context())
					if test.err == nil && (err != nil || account.Role != entities.RoleAdmin) {
						t.Error("admin was not attached to request")
					}
					if test.err != nil && !errors.Is(err, services.ErrUnauthenticated) {
						t.Error("anonymous request gained an account")
					}
					c.Status(http.StatusOK)
				})
				response := httptest.NewRecorder()
				router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))
				if response.Code != test.status || loader.calls != 1 {
					t.Fatalf("status = %d, calls = %d", response.Code, loader.calls)
				}
			})
		}
	}
}
