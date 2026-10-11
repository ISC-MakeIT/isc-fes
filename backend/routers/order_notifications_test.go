package routers

import (
	"errors"
	"testing"
	"time"

	"github.com/google/uuid"
	domain "github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/realtime"
)

func TestOrderNotificationEncodingFailureRequiresGuestResync(t *testing.T) {
	hub := realtime.NewHub()
	guestID := uuid.New()
	first, err := hub.Subscribe(guestID)
	if err != nil {
		t.Fatal(err)
	}
	defer first.Close()
	second, err := hub.Subscribe(guestID)
	if err != nil {
		t.Fatal(err)
	}
	defer second.Close()
	other, err := hub.Subscribe(uuid.New())
	if err != nil {
		t.Fatal(err)
	}
	defer other.Close()
	// PostgreSQLで表せてもRFC3339のJSONとして表せない日時。
	order := domain.Order{ID: uuid.New(), GuestID: guestID, UpdatedAt: time.Date(10000, 1, 1, 0, 0, 0, 0, time.UTC)}
	NewOrderStatusNotifier(hub).NotifyStatusChanged(order)
	for _, s := range []*realtime.Subscription{first, second} {
		select {
		case <-s.Done():
			if !errors.Is(s.Err(), realtime.ErrResyncRequired) {
				t.Fatalf("resync reason = %v", s.Err())
			}
		default:
			t.Fatal("encoding failure left stale connection active")
		}
		if len(s.Messages()) != 0 {
			t.Fatal("encoding failure queued an event")
		}
	}
	select {
	case <-other.Done():
		t.Fatal("encoding failure disconnected another Guest")
	default:
	}
	// 再接続は同じGuest IDでも登録可能。
	reconnected, err := hub.Subscribe(guestID)
	if err != nil {
		t.Fatal(err)
	}
	defer reconnected.Close()
}
