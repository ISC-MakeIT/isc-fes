package routers

import "testing"

func TestFrontendRedirectURL(t *testing.T) {
	tests := []struct {
		name        string
		frontendURL string
		redirectTo  string
		want        string
		wantErr     bool
	}{
		{
			name:        "フロントエンドのオリジンを基準にパスとクエリを解決する",
			frontendURL: "https://app.example.com",
			redirectTo:  "/invites/example-id?key=value",
			want:        "https://app.example.com/invites/example-id?key=value",
		},
		{
			name:        "外部の絶対URLへ遷移しない",
			frontendURL: "https://app.example.com",
			redirectTo:  "https://attacker.example/path",
			want:        "https://app.example.com/",
		},
		{
			name:        "外部のスキーム相対URLへ遷移しない",
			frontendURL: "https://app.example.com",
			redirectTo:  "//attacker.example/path",
			want:        "https://app.example.com/",
		},
		{
			name:        "不正な復帰先はルートへフォールバックする",
			frontendURL: "https://app.example.com",
			redirectTo:  "/orders?next=%zz",
			want:        "https://app.example.com/",
		},
		{
			name:        "不正なFRONTEND_URLを拒否する",
			frontendURL: "://missing-scheme",
			redirectTo:  "/orders",
			wantErr:     true,
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := frontendRedirectURL(test.frontendURL, test.redirectTo)
			if (err != nil) != test.wantErr {
				t.Fatalf("frontendRedirectURL()のエラー = %v、エラー期待値 %v", err, test.wantErr)
			}
			if got != test.want {
				t.Errorf("frontendRedirectURL() = %q、期待値 %q", got, test.want)
			}
		})
	}
}
