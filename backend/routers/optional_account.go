package routers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/isc-makeit/isc-fes/backend/services"
)

// 公開店舗GETでも、ログイン済みadminの閲覧権限を解決する。
func resolveOptionalStoreAccount(loader currentAccountLoader, handleError authenticationErrorHandler) gin.HandlerFunc {
	return func(c *gin.Context) {
		if c.Request.Method != http.MethodGet {
			return
		}
		switch c.FullPath() {
		case "/stores/:store_id", "/stores/:store_id/menus", "/stores/:store_id/menus/:menu_id/toppings":
		default:
			return
		}
		account, err := loader.GetCurrentAccount(c.Request.Context())
		if errors.Is(err, services.ErrUnauthenticated) {
			return
		}
		if err != nil {
			handleError(c, err)
			return
		}
		c.Request = c.Request.WithContext(services.WithAuthenticatedAccount(c.Request.Context(), account))
	}
}
