package service

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/google/uuid"
)

var (
	ErrUnauthenticated  = errors.New("unauthenticated")
	ErrInvalidLoginFlow = errors.New("invalid login flow")
	ErrLoginRejected    = errors.New("login rejected")
	ErrAccountNotFound  = errors.New("account not found")
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

type CompleteLoginInput struct {
	State         string
	Code          string
	ProviderError string
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
	// OAuth フローを開始する。
	// state, nonce, PKCE verifierを生成し、セッションに保存する。
	BeginOAuth(ctx context.Context) (OAuthFlow, error)

	// callback 時に、セッションに保存されたstate, nonce, PKCE verifierを元に検証し、OAuthフローを消費する。
	ConsumeOAuth(
		ctx context.Context,
		receivedState string,
	) (OAuthFlow, error)

	AccountID(ctx context.Context) (uuid.UUID, error)
	SignIn(ctx context.Context, accountID uuid.UUID) error
	SignOut(ctx context.Context) error
}

type AuthService struct {
	provider OAuthProvider
	sessions SessionManager
	accounts AccountRepository
}

func NewAuthService(
	provider OAuthProvider,
	sessions SessionManager,
	accounts AccountRepository,
) *AuthService {
	return &AuthService{
		provider: provider,
		sessions: sessions,
		accounts: accounts,
	}
}

// Google ログインを開始して、Google のログインページのURLを返す
// /auth/google/login で呼び出される。
func (s *AuthService) StartGoogleLogin(ctx context.Context) (string, error) {
	flow, err := s.sessions.BeginOAuth(ctx)
	if err != nil {
		return "", fmt.Errorf("begin OAuth: %w", err)
	}

	return s.provider.LoginURL(flow), nil
}

// Google ログインを完了する。
// /auth/google/callback で呼び出される。
func (s *AuthService) CompleteGoogleLogin(ctx context.Context, input CompleteLoginInput) error {
	flow, err := s.sessions.ConsumeOAuth(ctx, input.State)
	if err != nil {
		return fmt.Errorf("consume OAuth: %w", err)
	}

	// 正しいstateを消費してからキャンセル判定する。
	if input.ProviderError != "" {
		return ErrLoginRejected
	}

	identity, err := s.provider.ExchangeAndVerify(
		ctx,
		input.Code,
		flow,
	)
	if err != nil {
		return fmt.Errorf("verify Google identity: %w", err)
	}

	account, err := s.accounts.UpsertGoogleAccount(ctx, identity)
	if err != nil {
		return fmt.Errorf("upsert Google account: %w", err)
	}

	if err := s.sessions.SignIn(ctx, account.ID); err != nil {
		return fmt.Errorf("sign in account: %w", err)
	}

	return nil
}

func (s *AuthService) SignOut(ctx context.Context) error {
	return s.sessions.SignOut(ctx)
}
