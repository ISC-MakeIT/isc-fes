package routers

import (
	"context"
	"errors"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/services"
)

const guestSessionRequiredContextKey = "guest-session-required"

// guestResolverは、Guest必須のリクエストで既存Guestを解決し、
// 未発行なら新しいGuestとセッションを作成する境界。
type guestResolver interface {
	ResolveOrCreateGuest(ctx context.Context) (uuid.UUID, error)
}

// resolveRequiredGuestSessionは、OpenAPIでGuestSessionが指定されたリクエストだけ、
// OpenAPI検証の成功後にGuestを解決または新規発行する。
func resolveRequiredGuestSession(
	guestResolver guestResolver,
	handleError authenticationErrorHandler,
) gin.HandlerFunc {
	return func(c *gin.Context) {
		required, _ := c.Get(guestSessionRequiredContextKey)
		if required != true {
			c.Next()
			return
		}
		if guestResolver == nil {
			handleError(c, errors.New("guest resolver is not configured"))
			c.Abort()
			return
		}

		guestID, err := guestResolver.ResolveOrCreateGuest(c.Request.Context())
		if err != nil {
			handleError(c, err)
			c.Abort()
			return
		}

		c.Request = c.Request.WithContext(
			services.WithGuest(c.Request.Context(), guestID),
		)
		c.Next()
	}
}
