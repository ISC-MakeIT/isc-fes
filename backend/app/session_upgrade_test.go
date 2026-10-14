package app

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/alexedwards/scs/v2"
	"github.com/coder/websocket"
	"github.com/gin-gonic/gin"
	"github.com/isc-makeit/isc-fes/backend/realtime"
)

type failingSessionStore struct{ scs.Store }

func (s failingSessionStore) Commit(string, []byte, time.Time) error {
	return errors.New("session persistence unavailable")
}

func TestSessionUpgradeStopsWhenEitherSessionSaveFails(t *testing.T) {
	gin.SetMode(gin.TestMode)
	for _, failedSession := range []string{"account", "guest"} {
		t.Run(failedSession, func(t *testing.T) {
			account, guest := scs.New(), scs.New()
			account.Cookie.Name = "account"
			guest.Cookie.Name = "guest"
			failed := guest
			if failedSession == "account" {
				failed = account
			}
			failed.Store = failingSessionStore{Store: failed.Store}
			accepted := make(chan bool, 1)
			router := gin.New()
			router.GET("/ws/orders", func(c *gin.Context) {
				account.Put(c.Request.Context(), "account_id", "account")
				guest.Put(c.Request.Context(), "guest_id", "guest")
				conn, err := realtime.Accept(c.Writer, c.Request)
				accepted <- err == nil
				if conn != nil {
					conn.CloseNow()
				}
			})
			server := httptest.NewServer(guardSessionUpgrade(account.LoadAndSave(guest.LoadAndSave(router))))
			defer server.Close()
			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer cancel()
			conn, response, err := websocket.Dial(ctx, strings.Replace(server.URL, "http", "ws", 1)+"/ws/orders", nil)
			if conn != nil {
				conn.CloseNow()
				t.Fatal("client obtained a WebSocket after session save failure")
			}
			if err == nil || response == nil || response.StatusCode != http.StatusInternalServerError {
				t.Fatalf("response = %v, error = %v; want HTTP 500", response, err)
			}
			if response.Header.Get("Sec-WebSocket-Accept") != "" {
				t.Fatal("failed response contains WebSocket acceptance header")
			}
			select {
			case success := <-accepted:
				if success {
					t.Fatal("server obtained a WebSocket after session save failure")
				}
			case <-ctx.Done():
				t.Fatal("handler did not finish after session save failure")
			}
		})
	}
}
