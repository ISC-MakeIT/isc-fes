package services

import (
	"context"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"
	"unicode"

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
	RedirectTo   string
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

type StartGoogleLoginInput struct {
	RedirectTo string
}

type CompleteGoogleLoginOutput struct {
	RedirectTo string
}

type OAuthProvider interface {
	LoginURL(flow OAuthFlow) string
	ExchangeAndVerify(
		ctx context.Context,
		code string,
		flow OAuthFlow,
	) (GoogleIdentity, error)
}

// AuthSessionは、Google OAuthとAccountのログイン状態を管理する。
// Guestセッションとは独立したCookieとストアを使用する。
type AuthSession interface {
	// OAuth フローを開始する。
	// state, nonce, PKCE verifierを生成し、セッションに保存する。
	BeginOAuth(ctx context.Context, redirectTo string) (OAuthFlow, error)

	// callback 時に、セッションに保存されたstate, nonce, PKCE verifierを元に検証し、OAuthフローを消費する。
	ConsumeOAuth(
		ctx context.Context,
		receivedState string,
	) (OAuthFlow, error)

	SignIn(ctx context.Context, accountID uuid.UUID) error
	SignOut(ctx context.Context) error
}

type AuthService struct {
	provider OAuthProvider
	session  AuthSession
	accounts AccountRepository
}

func NewAuthService(
	provider OAuthProvider,
	session AuthSession,
	accounts AccountRepository,
) *AuthService {
	return &AuthService{
		provider: provider,
		session:  session,
		accounts: accounts,
	}
}

// Google ログインを開始して、Google のログインページのURLを返す
// /auth/google/login で呼び出される。
func (s *AuthService) StartGoogleLogin(
	ctx context.Context,
	input StartGoogleLoginInput,
) (string, error) {
	flow, err := s.session.BeginOAuth(
		ctx,
		normalizeLoginRedirectPath(input.RedirectTo),
	)
	if err != nil {
		return "", fmt.Errorf("begin OAuth: %w", err)
	}

	return s.provider.LoginURL(flow), nil
}

// Google ログインを完了する。
// /auth/google/callback で呼び出される。
func (s *AuthService) CompleteGoogleLogin(
	ctx context.Context,
	input CompleteLoginInput,
) (CompleteGoogleLoginOutput, error) {
	flow, err := s.session.ConsumeOAuth(ctx, input.State)
	if err != nil {
		return CompleteGoogleLoginOutput{}, fmt.Errorf("consume OAuth: %w", err)
	}

	// 正しいstateを消費してからキャンセル判定する。
	if input.ProviderError != "" {
		return CompleteGoogleLoginOutput{}, ErrLoginRejected
	}

	identity, err := s.provider.ExchangeAndVerify(
		ctx,
		input.Code,
		flow,
	)
	if err != nil {
		return CompleteGoogleLoginOutput{}, fmt.Errorf("verify Google identity: %w", err)
	}

	account, err := s.accounts.UpsertGoogleAccount(ctx, identity)
	if err != nil {
		return CompleteGoogleLoginOutput{}, fmt.Errorf("upsert Google account: %w", err)
	}

	if err := s.session.SignIn(ctx, account.ID); err != nil {
		return CompleteGoogleLoginOutput{}, fmt.Errorf("sign in account: %w", err)
	}

	return CompleteGoogleLoginOutput{
		RedirectTo: normalizeLoginRedirectPath(flow.RedirectTo),
	}, nil
}

const maxLoginRedirectPathLength = 2048

// normalizeLoginRedirectPath は、同一オリジン内の絶対パスだけを許可する。
// 不正・未指定の場合はフロントエンドのルートへフォールバックする。
func normalizeLoginRedirectPath(raw string) string {
	if raw == "" || len(raw) > maxLoginRedirectPathLength ||
		!strings.HasPrefix(raw, "/") ||
		strings.HasPrefix(raw, "//") ||
		strings.Contains(raw, `\`) ||
		strings.Contains(raw, "#") {
		return "/"
	}

	for _, r := range raw {
		if unicode.IsControl(r) {
			return "/"
		}
	}

	parsed, err := url.ParseRequestURI(raw)
	if err != nil || parsed.IsAbs() || parsed.Scheme != "" ||
		parsed.Host != "" || parsed.User != nil || parsed.Opaque != "" ||
		parsed.Fragment != "" {
		return "/"
	}
	if strings.HasPrefix(parsed.Path, "//") ||
		containsUnsafeRedirectCharacter(parsed.Path) {
		return "/"
	}

	decodedQuery, err := url.QueryUnescape(parsed.RawQuery)
	if err != nil || containsUnsafeRedirectCharacter(decodedQuery) {
		return "/"
	}

	return parsed.RequestURI()
}

func containsUnsafeRedirectCharacter(value string) bool {
	if strings.Contains(value, `\`) {
		return true
	}

	for _, r := range value {
		if unicode.IsControl(r) {
			return true
		}
	}

	return false
}

func (s *AuthService) SignOut(ctx context.Context) error {
	return s.session.SignOut(ctx)
}
