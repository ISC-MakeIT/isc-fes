package auth

import (
	"context"
	"crypto/rand"
	"crypto/subtle"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/alexedwards/scs/pgxstore"
	"github.com/alexedwards/scs/v2"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/oauth2"
)

const (
	accountIDKey = "account_id"

	oauthStateKey        = "oauth_state"
	oauthNonceKey        = "oauth_nonce"
	oauthPKCEVerifierKey = "oauth_pkce_verifier"
	oauthStartedAtKey    = "oauth_started_at"

	oauthFlowLifetime = 10 * time.Minute
)

var (
	ErrInvalidOAuthState = errors.New("invalid OAuth state")
	ErrOAuthFlowMissing  = errors.New("OAuth flow is missing")
	ErrOAuthFlowExpired  = errors.New("OAuth flow has expired")

	ErrNotAuthenticated = errors.New("not authenticated")
)

type AccountSession struct {
	manager *scs.SessionManager
}

func NewAccountSession(
	pool *pgxpool.Pool,
	secure bool,
	domain string,
) (*AccountSession, func()) {

	store := pgxstore.NewWithConfig(pool, pgxstore.Config{
		TableName:       "account_sessions",
		CleanUpInterval: 5 * time.Minute,
	})

	manager := scs.New()
	manager.Store = store
	manager.HashTokenInStore = true
	manager.Lifetime = 24 * time.Hour

	configureAccountSessionCookie(manager, secure, domain)

	session := &AccountSession{
		manager: manager,
	}

	return session, store.StopCleanup
}

// configureAccountSessionCookieは、AccountセッションCookieの属性を設定する。
// domainが空のローカル環境ではhost-only Cookieとし、
// 本番環境ではフロントエンドとAPIの共通ドメインへCookieを送信できるようにする。
func configureAccountSessionCookie(
	manager *scs.SessionManager,
	secure bool,
	domain string,
) {
	configureSessionCookie(
		manager,
		"isc_fes_account_session",
		secure,
		domain,
	)
}

func (s *AccountSession) LoadAndSave(next http.Handler) http.Handler {
	return s.manager.LoadAndSave(next)
}

func randomURLSafeToken() (string, error) {
	data := make([]byte, 32)

	if _, err := rand.Read(data); err != nil {
		return "", fmt.Errorf("generate random token: %w", err)
	}

	return base64.RawURLEncoding.EncodeToString(data), nil
}

func (s *AccountSession) BeginOAuth(ctx context.Context) (services.OAuthFlow, error) {
	state, err := randomURLSafeToken()
	if err != nil {
		return services.OAuthFlow{}, err
	}

	nonce, err := randomURLSafeToken()
	if err != nil {
		return services.OAuthFlow{}, err
	}

	flow := services.OAuthFlow{
		State:        state,
		Nonce:        nonce,
		PKCEVerifier: oauth2.GenerateVerifier(),
		StartedAt:    time.Now().UTC(),
	}

	s.manager.Put(ctx, oauthStateKey, flow.State)
	s.manager.Put(ctx, oauthNonceKey, flow.Nonce)
	s.manager.Put(ctx, oauthPKCEVerifierKey, flow.PKCEVerifier)
	s.manager.Put(ctx, oauthStartedAtKey, flow.StartedAt.Format(time.RFC3339Nano))

	return flow, nil
}

func (s *AccountSession) ConsumeOAuth(
	ctx context.Context,
	receivedState string,
) (services.OAuthFlow, error) {
	state := s.manager.GetString(ctx, oauthStateKey)
	nonce := s.manager.GetString(ctx, oauthNonceKey)
	pkceVerifier := s.manager.GetString(ctx, oauthPKCEVerifierKey)
	startedAtText := s.manager.GetString(ctx, oauthStartedAtKey)

	if state == "" ||
		nonce == "" ||
		pkceVerifier == "" ||
		startedAtText == "" {
		return services.OAuthFlow{}, ErrOAuthFlowMissing
	}

	if subtle.ConstantTimeCompare(
		[]byte(receivedState),
		[]byte(state),
	) != 1 {
		return services.OAuthFlow{}, ErrInvalidOAuthState
	}

	// 正しいstateを提示した場合だけ、OAuthフローを単回使用として削除する。
	s.removeOAuth(ctx)

	startedAt, err := time.Parse(time.RFC3339Nano, startedAtText)
	if err != nil {
		return services.OAuthFlow{}, fmt.Errorf("parse OAuth flow start time: %w", err)
	}

	flow := services.OAuthFlow{
		State:        state,
		Nonce:        nonce,
		PKCEVerifier: pkceVerifier,
		StartedAt:    startedAt,
	}

	age := time.Since(flow.StartedAt)
	if age < 0 || age > oauthFlowLifetime {
		return services.OAuthFlow{}, ErrOAuthFlowExpired
	}

	return flow, nil
}

func (s *AccountSession) removeOAuth(ctx context.Context) {
	s.manager.Remove(ctx, oauthStateKey)
	s.manager.Remove(ctx, oauthNonceKey)
	s.manager.Remove(ctx, oauthPKCEVerifierKey)
	s.manager.Remove(ctx, oauthStartedAtKey)
}

func (s *AccountSession) SignIn(
	ctx context.Context,
	accountID uuid.UUID,
) error {
	// Googleログイン前のセッショントークンを破棄して再発行する。
	// session fixation対策。
	if err := s.manager.RenewToken(ctx); err != nil {
		return fmt.Errorf("renew session token: %w", err)
	}

	// UUIDもGobの独自型として保存せず、文字列にする。
	s.manager.Put(ctx, accountIDKey, accountID.String())

	return nil
}

func (s *AccountSession) AccountID(ctx context.Context) (uuid.UUID, error) {
	value := s.manager.GetString(ctx, accountIDKey)
	if value == "" {
		return uuid.Nil, ErrNotAuthenticated
	}

	accountID, err := uuid.Parse(value)
	if err != nil {
		return uuid.Nil, fmt.Errorf(
			"%w: invalid account ID in session",
			ErrNotAuthenticated,
		)
	}

	return accountID, nil
}

func (s *AccountSession) SignOut(ctx context.Context) error {
	if err := s.manager.Destroy(ctx); err != nil {
		return fmt.Errorf("destroy session: %w", err)
	}

	return nil
}

var (
	_ services.AuthSession           = (*AccountSession)(nil)
	_ services.AccountSession        = (*AccountSession)(nil)
	_ services.CurrentAccountSession = (*AccountSession)(nil)
)
