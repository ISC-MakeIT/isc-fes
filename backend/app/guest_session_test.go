package app

import (
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestEnsureGuestCreatesAndReusesSession(t *testing.T) {
	f := newOrdersWebSocketFixture(t)
	client := newWebSocketClient(t)
	ensureGuest := func() {
		t.Helper()
		response, err := client.Post(f.server.URL+"/guests", "", nil)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		if response.StatusCode != http.StatusNoContent {
			t.Fatalf("POST /guests status = %d", response.StatusCode)
		}
	}
	ensureGuest()
	initialGuestID := uuid.MustParse(f.guestID(t, client))
	var initialCreatedAt time.Time
	if err := f.pool.QueryRow(t.Context(), `SELECT created_at FROM guests WHERE id=$1`, initialGuestID).Scan(&initialCreatedAt); err != nil {
		t.Fatal(err)
	}
	ensureGuest()
	var createdAt time.Time
	if err := f.pool.QueryRow(t.Context(), `SELECT created_at FROM guests WHERE id=$1`, initialGuestID).Scan(&createdAt); err != nil {
		t.Fatal(err)
	}
	if f.guestID(t, client) != initialGuestID.String() || !createdAt.Equal(initialCreatedAt) {
		t.Fatal("POST /guests replaced an existing guest or reset created_at")
	}
}
