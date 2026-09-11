package services

import (
	"context"
	"strings"
	"testing"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

func TestNormalizeLoginRedirectPath(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want string
	}{
		{name: "ルートパス", raw: "/", want: "/"},
		{
			name: "パスとクエリを保持する",
			raw:  "/invites/example-id?key=value&next=%2Forders",
			want: "/invites/example-id?key=value&next=%2Forders",
		},
		{name: "未指定", raw: "", want: "/"},
		{name: "絶対URLを拒否する", raw: "https://attacker.example/path", want: "/"},
		{name: "スキーム相対URLを拒否する", raw: "//attacker.example/path", want: "/"},
		{name: "スキームを拒否する", raw: "javascript:alert(1)", want: "/"},
		{name: "フラグメントを拒否する", raw: "/orders#details", want: "/"},
		{name: "バックスラッシュを拒否する", raw: `/\attacker.example`, want: "/"},
		{name: "エンコードされたバックスラッシュを拒否する", raw: "/%5Cattacker.example", want: "/"},
		{name: "制御文字を拒否する", raw: "/orders\nnext", want: "/"},
		{name: "エンコードされた制御文字を拒否する", raw: "/orders?next=%0Aevil", want: "/"},
		{name: "不正なエスケープを拒否する", raw: "/orders?next=%zz", want: "/"},
		{
			name: "最大文字数を許可する",
			raw:  "/" + strings.Repeat("a", maxLoginRedirectPathLength-1),
			want: "/" + strings.Repeat("a", maxLoginRedirectPathLength-1),
		},
		{
			name: "最大文字数超過を拒否する",
			raw:  "/" + strings.Repeat("a", maxLoginRedirectPathLength),
			want: "/",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			if got := normalizeLoginRedirectPath(test.raw); got != test.want {
				t.Errorf("normalizeLoginRedirectPath(%q) = %q、期待値 %q", test.raw, got, test.want)
			}
		})
	}
}

type oauthTestSession struct {
	beginRedirectTo string
	consumeFlow     OAuthFlow
	signedInID      uuid.UUID
}

func (s *oauthTestSession) BeginOAuth(_ context.Context, redirectTo string) (OAuthFlow, error) {
	s.beginRedirectTo = redirectTo
	return OAuthFlow{State: "state", RedirectTo: redirectTo}, nil
}

func (s *oauthTestSession) ConsumeOAuth(context.Context, string) (OAuthFlow, error) {
	return s.consumeFlow, nil
}

func (s *oauthTestSession) SignIn(_ context.Context, accountID uuid.UUID) error {
	s.signedInID = accountID
	return nil
}

func (s *oauthTestSession) SignOut(context.Context) error { return nil }

type oauthTestProvider struct{}

func (oauthTestProvider) LoginURL(flow OAuthFlow) string {
	return "https://accounts.example/" + flow.State
}

func (oauthTestProvider) ExchangeAndVerify(
	context.Context,
	string,
	OAuthFlow,
) (GoogleIdentity, error) {
	return GoogleIdentity{Subject: "google-sub"}, nil
}

type oauthTestAccountRepository struct {
	account entities.Account
}

func (r oauthTestAccountRepository) GetAccountByID(
	context.Context,
	uuid.UUID,
) (entities.Account, error) {
	return r.account, nil
}

func (r oauthTestAccountRepository) UpsertGoogleAccount(
	context.Context,
	GoogleIdentity,
) (entities.Account, error) {
	return r.account, nil
}

func TestStartGoogleLoginSanitizesRedirectTo(t *testing.T) {
	session := &oauthTestSession{}
	service := NewAuthService(oauthTestProvider{}, session, oauthTestAccountRepository{})

	_, err := service.StartGoogleLogin(context.Background(), StartGoogleLoginInput{
		RedirectTo: "https://attacker.example",
	})
	if err != nil {
		t.Fatalf("StartGoogleLogin()で予期しないエラー: %v", err)
	}
	if session.beginRedirectTo != "/" {
		t.Errorf("BeginOAuth()のredirectTo = %q、期待値 /", session.beginRedirectTo)
	}
}

func TestCompleteGoogleLoginReturnsRedirectTo(t *testing.T) {
	accountID := uuid.New()
	session := &oauthTestSession{
		consumeFlow: OAuthFlow{RedirectTo: "/invites/example-id?key=value"},
	}
	service := NewAuthService(
		oauthTestProvider{},
		session,
		oauthTestAccountRepository{account: entities.Account{ID: accountID}},
	)

	output, err := service.CompleteGoogleLogin(
		context.Background(),
		CompleteLoginInput{State: "state", Code: "code"},
	)
	if err != nil {
		t.Fatalf("CompleteGoogleLogin()で予期しないエラー: %v", err)
	}
	if output.RedirectTo != "/invites/example-id?key=value" {
		t.Errorf("RedirectTo = %q、期待値 /invites/example-id?key=value", output.RedirectTo)
	}
	if session.signedInID != accountID {
		t.Errorf("サインインしたアカウントID = %v、期待値 %v", session.signedInID, accountID)
	}
}
