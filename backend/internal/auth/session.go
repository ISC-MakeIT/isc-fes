package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/alexedwards/scs/pgxstore"
	"github.com/alexedwards/scs/v2"
	"github.com/jackc/pgx/v5/pgxpool"
	"golang.org/x/oauth2"
)

const (
	oauthStateKey        = "oauth_state"
	oauthNonceKey        = "oauth_nonce"
	oauthPKCEVerifierKey = "oauth_pkce_verifier"
	oauthStartedAtKey    = "oauth_started_at"

	oauthFlowLifetime = 10 * time.Minute
)

var (
	ErrOAuthFlowMissing = errors.New("OAuth flow is missing")
	ErrOAuthFlowExpired = errors.New("OAuth flow has expired")
)

type OAuthFlow struct {
	State        string
	Nonce        string
	PKCEVerifier string
	StartedAt    time.Time
}

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

func (s *Sessions) BeginOAuth(ctx context.Context) (OAuthFlow, error) {
	state, err := randomURLSafeToken()
	if err != nil {
		return OAuthFlow{}, err
	}

	nonce, err := randomURLSafeToken()
	if err != nil {
		return OAuthFlow{}, err
	}

	flow := OAuthFlow{
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

func (s *Sessions) PopOAuth(ctx context.Context) (OAuthFlow, error) {
	flow := OAuthFlow{
		State:        s.manager.PopString(ctx, oauthStateKey),
		Nonce:        s.manager.PopString(ctx, oauthNonceKey),
		PKCEVerifier: s.manager.PopString(ctx, oauthPKCEVerifierKey),
		StartedAt:    s.manager.PopTime(ctx, oauthStartedAtKey),
	}

	if flow.State == "" ||
		flow.Nonce == "" ||
		flow.PKCEVerifier == "" ||
		flow.StartedAt.IsZero() {
		return OAuthFlow{}, ErrOAuthFlowMissing
	}

	age := time.Since(flow.StartedAt)
	if age < 0 || age > oauthFlowLifetime {
		return OAuthFlow{}, ErrOAuthFlowExpired
	}

	return flow, nil
}
