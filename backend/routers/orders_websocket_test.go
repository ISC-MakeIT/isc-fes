package routers

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/gin-gonic/gin"
)

func TestOrdersWebSocketRejectsBeforeGuestIssuance(t *testing.T) {
	gin.SetMode(gin.TestMode)
	const origin = "https://frontend.example.com"
	tests := []struct {
		name   string
		mutate func(*http.Request)
		status int
	}{
		{"missing origin", func(r *http.Request) { r.Header.Del("Origin") }, 403},
		{"null origin", func(r *http.Request) { r.Header.Set("Origin", "null") }, 403},
		{"malformed origin", func(r *http.Request) { r.Header.Set("Origin", "://invalid") }, 403},
		{"unknown origin", func(r *http.Request) { r.Header.Set("Origin", "https://other.example.com") }, 403},
		{"same host outside allowlist", func(r *http.Request) {
			r.Host = "other.example.com"
			r.Header.Set("Origin", "https://other.example.com")
		}, 403},
		{"wrong scheme", func(r *http.Request) { r.Header.Set("Origin", "http://frontend.example.com") }, 403},
		{"wrong port", func(r *http.Request) { r.Header.Set("Origin", origin+":8443") }, 403},
		{"origin with path", func(r *http.Request) { r.Header.Set("Origin", origin+"/") }, 403},
		{"origin with userinfo", func(r *http.Request) { r.Header.Set("Origin", "https://user@frontend.example.com") }, 403},
		{"multiple origins", func(r *http.Request) { r.Header.Add("Origin", origin) }, 403},
		{"ordinary GET", func(r *http.Request) {
			r.Header.Del("Connection")
			r.Header.Del("Upgrade")
		}, 426},
		{"missing upgrade", func(r *http.Request) { r.Header.Del("Upgrade") }, 426},
		{"HTTP 1.0", func(r *http.Request) { r.ProtoMinor = 0 }, 426},
		{"unsupported version", func(r *http.Request) { r.Header.Set("Sec-WebSocket-Version", "12") }, 400},
		{"missing key", func(r *http.Request) { r.Header.Del("Sec-WebSocket-Key") }, 400},
		{"invalid key", func(r *http.Request) { r.Header.Set("Sec-WebSocket-Key", "not base64") }, 400},
		{"short key", func(r *http.Request) { r.Header.Set("Sec-WebSocket-Key", "c2hvcnQ=") }, 400},
		{"multiple keys", func(r *http.Request) { r.Header.Add("Sec-WebSocket-Key", "dGhlIHNhbXBsZSBub25jZQ==") }, 400},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			resolver := &stubGuestResolver{}
			router, err := NewRouter(&Server{guestResolver: resolver}, []string{origin})
			if err != nil {
				t.Fatal(err)
			}
			r := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/ws/orders", nil)
			r.Header = http.Header{
				"Origin": {origin}, "Connection": {"keep-alive, Upgrade"}, "Upgrade": {"websocket"},
				"Sec-Websocket-Version": {"13"}, "Sec-Websocket-Key": {"dGhlIHNhbXBsZSBub25jZQ=="},
			}
			tt.mutate(r)
			w := httptest.NewRecorder()
			router.ServeHTTP(w, r)
			if w.Code != tt.status || resolver.calls != 0 {
				t.Fatalf("status = %d, Guest calls = %d; want %d and 0", w.Code, resolver.calls, tt.status)
			}
		})
	}
}

func TestOrdersWebSocketGuestFailure(t *testing.T) {
	gin.SetMode(gin.TestMode)
	const origin = "https://frontend.example.com"
	router, err := NewRouter(&Server{guestResolver: &stubGuestResolver{err: errors.New("database unavailable")}}, []string{origin})
	if err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(router)
	defer server.Close()
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	conn, response, err := websocket.Dial(ctx, strings.Replace(server.URL, "http", "ws", 1)+"/ws/orders", &websocket.DialOptions{
		HTTPHeader: http.Header{"Origin": {origin}},
	})
	if conn != nil {
		conn.CloseNow()
		t.Fatal("WebSocket accepted after Guest failure")
	}
	if err == nil || response == nil || response.StatusCode != http.StatusInternalServerError {
		t.Fatalf("response = %v, error = %v; want HTTP 500", response, err)
	}
}
