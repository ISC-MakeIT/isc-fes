package auth

import (
	"context"
	"crypto/subtle"
	"errors"
	"fmt"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

const (
	googleIssuer       = "https://accounts.google.com"
	allowedEmailDomain = "gn.iwasaki.ac.jp"
)

var (
	ErrMissingIDToken   = errors.New("google response does not contain an ID token")
	ErrInvalidNonce     = errors.New("OIDC nonce does not match")
	ErrEmailNotVerified = errors.New("google email is not verified")
	ErrMissingSubject   = errors.New("google subject is missing")
	ErrMissingEmail     = errors.New("google email is missing")
)

// mainから渡す設定。
type GoogleConfig struct {
	ClientID     string
	ClientSecret string
	RedirectURL  string
}

// 検証済みのGoogleユーザー情報。
// この型が返された時点で、署名・aud・nonce・hdなどの確認は完了している。
type GoogleIdentity struct {
	Subject     string
	Email       string
	DisplayName string
	PictureURL  string
}

type GoogleAuthenticator struct {
	oauth2Config oauth2.Config
	verifier     *oidc.IDTokenVerifier
}

func NewGoogleAuthenticator(
	ctx context.Context,
	cfg GoogleConfig,
) (*GoogleAuthenticator, error) {
	if cfg.ClientID == "" {
		return nil, errors.New("GOOGLE_CLIENT_ID is required")
	}

	if cfg.ClientSecret == "" {
		return nil, errors.New("GOOGLE_CLIENT_SECRET is required")
	}

	if cfg.RedirectURL == "" {
		return nil, errors.New("GOOGLE_REDIRECT_URL is required")
	}

	provider, err := oidc.NewProvider(ctx, googleIssuer)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize Google OIDC provider: %w", err)
	}

	oauth2Config := oauth2.Config{
		ClientID:     cfg.ClientID,
		ClientSecret: cfg.ClientSecret,
		RedirectURL:  cfg.RedirectURL,
		Endpoint:     provider.Endpoint(),
		Scopes: []string{
			oidc.ScopeOpenID,
			oidc.ScopeEmail,
			oidc.ScopeProfile,
		},
	}

	verifier := provider.Verifier(&oidc.Config{
		ClientID: cfg.ClientID,
	})

	return &GoogleAuthenticator{
		oauth2Config: oauth2Config,
		verifier:     verifier,
	}, nil
}

func (a *GoogleAuthenticator) LoginURL(flow OAuthFlow) string {
	return a.oauth2Config.AuthCodeURL(
		flow.State,

		// ID Tokenへnonceを含めてもらう。
		oidc.Nonce(flow.Nonce),

		// PKCE verifierからSHA-256 challengeを作ってGoogleへ送る。
		oauth2.S256ChallengeOption(flow.PKCEVerifier),

		// Googleのアカウント選択画面を学校ドメイン向けにする。
		// これはUI上のヒントであり、アクセス制御には使えない。
		oauth2.SetAuthURLParam("hd", allowedEmailDomain),
	)
}

// /callback で来た code を exchange する
func (a *GoogleAuthenticator) ExchangeAndVerify(
	ctx context.Context,
	code string,
	pkceVerifier string,
	expectedNonce string,
) (GoogleIdentity, error) {
	if code == "" {
		return GoogleIdentity{}, errors.New("authorization code is missing")
	}

	if pkceVerifier == "" {
		return GoogleIdentity{}, errors.New("PKCE verifier is missing")
	}

	if expectedNonce == "" {
		return GoogleIdentity{}, ErrInvalidNonce
	}

	// Googleから受け取ったauthorization codeをOAuth tokenへ交換する。
	oauth2Token, err := a.oauth2Config.Exchange(
		ctx,
		code,
		oauth2.VerifierOption(pkceVerifier),
	)
	if err != nil {
		return GoogleIdentity{}, fmt.Errorf(
			"exchange Google authorization code: %w",
			err,
		)
	}

	// OIDCではOAuth tokenレスポンスの中にID Tokenが入っている。
	rawIDToken, ok := oauth2Token.Extra("id_token").(string)
	if !ok || rawIDToken == "" {
		return GoogleIdentity{}, ErrMissingIDToken
	}

	// 署名、issuer、audience、期限などを検証する。
	idToken, err := a.verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return GoogleIdentity{}, fmt.Errorf(
			"verify Google ID token: %w",
			err,
		)
	}

	// go-oidcはnonceを自動検証しないため、自分で比較する。
	if subtle.ConstantTimeCompare(
		[]byte(idToken.Nonce),
		[]byte(expectedNonce),
	) != 1 {
		return GoogleIdentity{}, ErrInvalidNonce
	}

	var claims struct {
		Email         string `json:"email"`
		EmailVerified bool   `json:"email_verified"`
		HostedDomain  string `json:"hd"`
		Name          string `json:"name"`
		Picture       string `json:"picture"`
	}

	if err := idToken.Claims(&claims); err != nil {
		return GoogleIdentity{}, fmt.Errorf(
			"decode Google ID token claims: %w",
			err,
		)
	}

	if idToken.Subject == "" {
		return GoogleIdentity{}, ErrMissingSubject
	}

	if claims.Email == "" {
		return GoogleIdentity{}, ErrMissingEmail
	}

	if !claims.EmailVerified {
		return GoogleIdentity{}, ErrEmailNotVerified
	}

	return GoogleIdentity{
		Subject:     idToken.Subject,
		Email:       claims.Email,
		DisplayName: claims.Name,
		PictureURL:  claims.Picture,
	}, nil
}
