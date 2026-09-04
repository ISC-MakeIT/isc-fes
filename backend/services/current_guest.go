package services

import (
	"context"
	"errors"

	"github.com/google/uuid"
)

// ErrGuestNotResolvedは、Guest必須のServiceがGuest解決処理を通らずに呼ばれたことを示す。
// クライアントの未認証ではなく、Router構成の不備として扱う。
var ErrGuestNotResolved = errors.New("guest is not resolved in request context")

type guestContextKey struct{}

// WithGuestは、セッションから解決済みのGuest IDをリクエストContextへ格納する。
// リクエスト値から受け取ったGuest IDには使用しない。
func WithGuest(ctx context.Context, guestID uuid.UUID) context.Context {
	return context.WithValue(ctx, guestContextKey{}, guestID)
}

// CurrentGuestは、リクエストContextに格納されたGuest IDを任意で取得する。
// Guest未発行を許容するCart GETなどで使用する。
func CurrentGuest(ctx context.Context) (guestID uuid.UUID, found bool) {
	guestID, ok := ctx.Value(guestContextKey{}).(uuid.UUID)
	if !ok || guestID == uuid.Nil {
		return uuid.Nil, false
	}

	return guestID, true
}

// RequireGuestは、リクエストContextに格納されたGuest IDを取得する。
// Cart更新や注文など、Guestを必須とするServiceで使用する。
func RequireGuest(ctx context.Context) (uuid.UUID, error) {
	guestID, found := CurrentGuest(ctx)
	if !found {
		return uuid.Nil, ErrGuestNotResolved
	}

	return guestID, nil
}
