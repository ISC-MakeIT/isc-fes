package service

import (
	"context"
	"time"

	"github.com/google/uuid"
)

type OAuthFlow struct {
	State        string
	Nonce        string
	PKCEVerifier string
	StartedAt    time.Time
}

// 検証済みのGoogleユーザー情報。
// この型が返された時点で、署名・aud・nonce・hdなどの確認は完了している。
type GoogleIdentity struct {
	Subject     string
	Email       string
	DisplayName string
	PictureURL  string
}

type OAuthFlowStore interface {
	BeginOAuth(ctx context.Context) (OAuthFlow, error)
	ConsumeOAuth(
		ctx context.Context,
		receivedState string,
	) (OAuthFlow, error)
}

type OAuthProvider interface {
	LoginURL(flow OAuthFlow) string
	ExchangeAndVerify(
		ctx context.Context,
		code string,
		flow OAuthFlow,
	) (GoogleIdentity, error)
}

type SessionManager interface {
	AccountID(ctx context.Context) (uuid.UUID, error)
	SignIn(ctx context.Context, accountID uuid.UUID) error
	SignOut(ctx context.Context) error
}

type AuthService struct {
	provider OAuthProvider
	sessions SessionManager
	flows    OAuthFlowStore
}

func NewAuthService(
	provider OAuthProvider,
	sessions SessionManager,
	flows OAuthFlowStore,
) *AuthService {
	return &AuthService{
		provider: provider,
		sessions: sessions,
		flows:    flows,
	}
}
