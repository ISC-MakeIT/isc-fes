package auth

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/alexedwards/scs/v2"
	"github.com/google/uuid"
)

// 正しいstateでOAuthフローを取得でき、取得後は再利用できないことを確認する。
// これによりcallbackのリプレイを防ぐ単回使用であることをテストする。
func TestConsumeOAuthWithValidStateConsumesFlow(t *testing.T) {
	sessions, ctx := newTestAccountSession(t)

	want, err := sessions.BeginOAuth(ctx)
	if err != nil {
		t.Fatalf("BeginOAuth() error = %v", err)
	}

	// Googleへリダイレクトした後、callbackで別リクエストとして戻る状況を再現する。
	ctx = commitAndReloadSession(t, sessions, ctx)

	got, err := sessions.ConsumeOAuth(ctx, want.State)
	if err != nil {
		t.Fatalf("ConsumeOAuth() error = %v", err)
	}

	if got.State != want.State {
		t.Errorf("State = %q, want %q", got.State, want.State)
	}
	if got.Nonce != want.Nonce {
		t.Errorf("Nonce = %q, want %q", got.Nonce, want.Nonce)
	}
	if got.PKCEVerifier != want.PKCEVerifier {
		t.Errorf(
			"PKCEVerifier = %q, want %q",
			got.PKCEVerifier,
			want.PKCEVerifier,
		)
	}
	if !got.StartedAt.Equal(want.StartedAt) {
		t.Errorf("StartedAt = %v, want %v", got.StartedAt, want.StartedAt)
	}

	// ConsumeOAuthによる削除もDB相当のStoreへ保存し、次のリクエストで確認する。
	ctx = commitAndReloadSession(t, sessions, ctx)

	_, err = sessions.ConsumeOAuth(ctx, want.State)
	if !errors.Is(err, ErrOAuthFlowMissing) {
		t.Fatalf(
			"second ConsumeOAuth() error = %v, want %v",
			err,
			ErrOAuthFlowMissing,
		)
	}
}

// 不正なstateを受け取っても、正規ユーザーが開始したOAuthフローを
// 攻撃者のリクエストで破棄できないことを確認する。
func TestConsumeOAuthWithInvalidStatePreservesFlow(t *testing.T) {
	sessions, ctx := newTestAccountSession(t)

	flow, err := sessions.BeginOAuth(ctx)
	if err != nil {
		t.Fatalf("BeginOAuth() error = %v", err)
	}

	ctx = commitAndReloadSession(t, sessions, ctx)

	_, err = sessions.ConsumeOAuth(ctx, "invalid-state")
	if !errors.Is(err, ErrInvalidOAuthState) {
		t.Fatalf(
			"ConsumeOAuth() error = %v, want %v",
			err,
			ErrInvalidOAuthState,
		)
	}

	// 不正なcallbackでフローが破棄されていないことを確認する。
	if _, err := sessions.ConsumeOAuth(ctx, flow.State); err != nil {
		t.Fatalf(
			"ConsumeOAuth() after invalid state error = %v",
			err,
		)
	}
}

// 有効期限を過ぎたOAuthフローを拒否し、正しいstateを提示済みの
// 期限切れフローは再利用できないことを確認する。
func TestConsumeOAuthRejectsAndConsumesExpiredFlow(t *testing.T) {
	sessions, ctx := newTestAccountSession(t)

	flow, err := sessions.BeginOAuth(ctx)
	if err != nil {
		t.Fatalf("BeginOAuth() error = %v", err)
	}

	// 待ち時間のあるテストにせず、保存時刻を直接期限切れへ変更する。
	expiredStartedAt := time.Now().
		Add(-oauthFlowLifetime - time.Second).
		UTC().
		Format(time.RFC3339Nano)
	sessions.manager.Put(ctx, oauthStartedAtKey, expiredStartedAt)

	ctx = commitAndReloadSession(t, sessions, ctx)

	_, err = sessions.ConsumeOAuth(ctx, flow.State)
	if !errors.Is(err, ErrOAuthFlowExpired) {
		t.Fatalf(
			"ConsumeOAuth() error = %v, want %v",
			err,
			ErrOAuthFlowExpired,
		)
	}

	ctx = commitAndReloadSession(t, sessions, ctx)

	_, err = sessions.ConsumeOAuth(ctx, flow.State)
	if !errors.Is(err, ErrOAuthFlowMissing) {
		t.Fatalf(
			"second ConsumeOAuth() error = %v, want %v",
			err,
			ErrOAuthFlowMissing,
		)
	}
}

// SignInで保存したaccount IDがリクエストをまたいでも復元できることを確認する。
// UUIDはGobへ直接保存せず文字列化しているため、CommitとLoadも実際に通す。
func TestSignInPersistsAccountID(t *testing.T) {
	sessions, ctx := newTestAccountSession(t)
	want := uuid.New()

	if err := sessions.SignIn(ctx, want); err != nil {
		t.Fatalf("SignIn() error = %v", err)
	}

	ctx = commitAndReloadSession(t, sessions, ctx)

	got, err := sessions.AccountID(ctx)
	if err != nil {
		t.Fatalf("AccountID() error = %v", err)
	}
	if got != want {
		t.Errorf("AccountID() = %v, want %v", got, want)
	}
}

// account IDがないセッションを、ログイン済みとして扱わないことを確認する。
func TestAccountIDWithoutSignIn(t *testing.T) {
	sessions, ctx := newTestAccountSession(t)

	_, err := sessions.AccountID(ctx)
	if !errors.Is(err, ErrNotAuthenticated) {
		t.Fatalf(
			"AccountID() error = %v, want %v",
			err,
			ErrNotAuthenticated,
		)
	}
}

// 本番で指定した共通ドメインと、ローカルのhost-only Cookieの両方を設定できることを確認する。
func TestConfigureSessionCookieDomain(t *testing.T) {
	tests := []struct {
		name   string
		domain string
	}{
		{
			name:   "本番で共通ドメインを設定する",
			domain: "fes.iwasaki.ac.jp",
		},
		{
			name:   "ローカルでhost-only Cookieにする",
			domain: "",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			manager := scs.New()

			configureAccountSessionCookie(manager, true, test.domain)

			if manager.Cookie.Domain != test.domain {
				t.Errorf(
					"Cookie.Domain = %q, want %q",
					manager.Cookie.Domain,
					test.domain,
				)
			}
			if !manager.Cookie.Secure {
				t.Error("Cookie.Secure = false, want true")
			}
			if !manager.Cookie.HttpOnly {
				t.Error("Cookie.HttpOnly = false, want true")
			}
			if manager.Cookie.SameSite != http.SameSiteLaxMode {
				t.Errorf(
					"Cookie.SameSite = %v, want %v",
					manager.Cookie.SameSite,
					http.SameSiteLaxMode,
				)
			}
		})
	}
}

// Postgresを起動せず高速に実行できるよう、SCS標準のメモリStoreを使う。
// HashTokenInStoreは本番と同じ設定にして、Cookieの生トークンではなく
// ハッシュをStoreのキーとして扱う経路もテストする。
func newTestAccountSession(t *testing.T) (*AccountSession, context.Context) {
	t.Helper()

	manager := scs.New()
	manager.HashTokenInStore = true

	ctx, err := manager.Load(context.Background(), "")
	if err != nil {
		t.Fatalf("load test session: %v", err)
	}

	return &AccountSession{manager: manager}, ctx
}

// セッションをStoreへ保存し、Cookieから受け取ったトークンで次のリクエストへ
// 読み直す処理を再現する。単一context内だけのテストでは見つけられない
// Gobエンコードや永続化の問題も、この境界を通すことで検出できる。
func commitAndReloadSession(
	t *testing.T,
	sessions *AccountSession,
	ctx context.Context,
) context.Context {
	t.Helper()

	token, _, err := sessions.manager.Commit(ctx)
	if err != nil {
		t.Fatalf("commit test session: %v", err)
	}

	nextCtx, err := sessions.manager.Load(context.Background(), token)
	if err != nil {
		t.Fatalf("reload test session: %v", err)
	}

	return nextCtx
}
