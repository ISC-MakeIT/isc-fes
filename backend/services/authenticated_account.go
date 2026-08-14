package services

import (
	"context"

	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

type authenticatedAccountContextKey struct{}

// WithAuthenticatedAccount は認証済みアカウントをリクエストスコープの Context に格納する。
func WithAuthenticatedAccount(ctx context.Context, account entities.Account) context.Context {
	return context.WithValue(ctx, authenticatedAccountContextKey{}, account)
}

// RequireAuthenticatedAccount はリクエストスコープの認証済みアカウントを取得する。
// 認証済みアカウントが格納されていない場合は ErrUnauthenticated を返す。
func RequireAuthenticatedAccount(ctx context.Context) (entities.Account, error) {
	account, ok := ctx.Value(authenticatedAccountContextKey{}).(entities.Account)
	if !ok {
		return entities.Account{}, ErrUnauthenticated
	}

	return account, nil
}
