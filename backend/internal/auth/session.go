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
	"github.com/isc-makeit/isc-fes/backend/internal/service"
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

type Sessions struct {
	manager *scs.SessionManager
}

func NewSessions(
	pool *pgxpool.Pool,
	secure bool,
) (*Sessions, func()) {

	store := pgxstore.New(pool)

	manager := scs.New()
	manager.Store = store
	manager.HashTokenInStore = true
	manager.Lifetime = 24 * time.Hour

	manager.Cookie.Name = "isc_fes_account_session"
	manager.Cookie.Path = "/"
	manager.Cookie.Domain = ""
	manager.Cookie.HttpOnly = true
	manager.Cookie.SameSite = http.SameSiteLaxMode
	manager.Cookie.Secure = secure
	manager.Cookie.Persist = true

	sessions := &Sessions{
		manager: manager,
	}

	return sessions, store.StopCleanup
}

func (s *Sessions) LoadAndSave(next http.Handler) http.Handler {
	return s.manager.LoadAndSave(next)
}

func randomURLSafeToken() (string, error) {
	data := make([]byte, 32)

	if _, err := rand.Read(data); err != nil {
		return "", fmt.Errorf("generate random token: %w", err)
	}

	return base64.RawURLEncoding.EncodeToString(data), nil
}

func (s *Sessions) BeginOAuth(ctx context.Context) (service.OAuthFlow, error) {
	state, err := randomURLSafeToken()
	if err != nil {
		return service.OAuthFlow{}, err
	}

	nonce, err := randomURLSafeToken()
	if err != nil {
		return service.OAuthFlow{}, err
	}

	flow := service.OAuthFlow{
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

func (s *Sessions) ConsumeOAuth(
	ctx context.Context,
	receivedState string,
) (service.OAuthFlow, error) {
	state := s.manager.GetString(ctx, oauthStateKey)
	nonce := s.manager.GetString(ctx, oauthNonceKey)
	pkceVerifier := s.manager.GetString(ctx, oauthPKCEVerifierKey)
	startedAtText := s.manager.GetString(ctx, oauthStartedAtKey)

	if state == "" ||
		nonce == "" ||
		pkceVerifier == "" ||
		startedAtText == "" {
		return service.OAuthFlow{}, ErrOAuthFlowMissing
	}

	if subtle.ConstantTimeCompare(
		[]byte(receivedState),
		[]byte(state),
	) != 1 {
		return service.OAuthFlow{}, ErrInvalidOAuthState
	}

	// 正しいstateを提示した場合だけ、OAuthフローを単回使用として削除する。
	s.removeOAuth(ctx)

	startedAt, err := time.Parse(time.RFC3339Nano, startedAtText)
	if err != nil {
		return service.OAuthFlow{}, fmt.Errorf("parse OAuth flow start time: %w", err)
	}

	flow := service.OAuthFlow{
		State:        state,
		Nonce:        nonce,
		PKCEVerifier: pkceVerifier,
		StartedAt:    startedAt,
	}

	age := time.Since(flow.StartedAt)
	if age < 0 || age > oauthFlowLifetime {
		return service.OAuthFlow{}, ErrOAuthFlowExpired
	}

	return flow, nil
}

func (s *Sessions) removeOAuth(ctx context.Context) {
	s.manager.Remove(ctx, oauthStateKey)
	s.manager.Remove(ctx, oauthNonceKey)
	s.manager.Remove(ctx, oauthPKCEVerifierKey)
	s.manager.Remove(ctx, oauthStartedAtKey)
}

func (s *Sessions) SignIn(
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

func (s *Sessions) AccountID(ctx context.Context) (uuid.UUID, error) {
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

func (s *Sessions) SignOut(ctx context.Context) error {
	if err := s.manager.Destroy(ctx); err != nil {
		return fmt.Errorf("destroy session: %w", err)
	}

	return nil
}

var (
	_ service.SessionManager = (*Sessions)(nil)
)
