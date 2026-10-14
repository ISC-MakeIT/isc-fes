package routers

import (
	"github.com/google/uuid"
	domain "github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/realtime"
	"testing"
	"time"
)

func TestOrderNotificationPublishesOnlyOrderIDToOwningGuest(t *testing.T) {
	hub := realtime.NewHub()
	guestID, orderID := uuid.New(), uuid.New()
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
	// 通知は一覧を持たないため、OrderのJSON化もDB取得も行わない。
	order := domain.Order{ID: orderID, GuestID: guestID, StoreID: uuid.New(),
		UpdatedAt: time.Date(10000, 1, 1, 0, 0, 0, 0, time.UTC)}
	NewOrderStatusNotifier(hub).NotifyStatusChanged(order)
	for _, s := range []*realtime.Subscription{first, second} {
		select {
		case got := <-s.Changes():
			if got != orderID {
				t.Fatalf("order ID = %s, want %s", got, orderID)
			}
		default:
			t.Fatal("owning Guest did not receive invalidation")
		}
	}
	select {
	case <-other.Changes():
		t.Fatal("notification leaked to another Guest")
	default:
	}
}
