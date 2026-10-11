package realtime

import (
	"context"
	"errors"
	"fmt"
	"sync"
	"testing"

	"github.com/google/uuid"
)

func subscribe(t *testing.T, h *Hub, id uuid.UUID) *Subscription {
	t.Helper()
	s, err := h.Subscribe(id)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(s.Close)
	return s
}

func TestHubGuestIsolationMultipleConnectionsAndImmutableMessages(t *testing.T) {
	h := NewHub()
	id := uuid.New()
	first, second := subscribe(t, h, id), subscribe(t, h, id)
	other := subscribe(t, h, uuid.New())
	message := []byte(`{"version":1}`)
	if err := h.Publish(id, message); err != nil {
		t.Fatal(err)
	}
	message[0] = 'x'
	if err := h.Publish(id, []byte(`{"version":2}`)); err != nil {
		t.Fatal(err)
	}
	for _, s := range []*Subscription{first, second} {
		for _, expected := range []string{`{"version":1}`, `{"version":2}`} {
			select {
			case actual := <-s.Messages():
				if actual != expected {
					t.Fatalf("message = %s, want %s", actual, expected)
				}
			default:
				t.Fatal("same Guest connection did not receive message")
			}
		}
	}
	select {
	case <-other.Messages():
		t.Fatal("message leaked to another Guest")
	default:
	}
	first.Close()
	first.Close()
	if err := h.Publish(id, []byte(`{"version":3}`)); err != nil {
		t.Fatal(err)
	}
	if actual := <-second.Messages(); actual != `{"version":3}` {
		t.Fatalf("remaining connection message = %s", actual)
	}
	if len(first.Messages()) != 0 {
		t.Fatal("unregistered connection received a new message")
	}
}

func TestHubQueueOverflowOnlyStopsSlowConnection(t *testing.T) {
	h := NewHub()
	id := uuid.New()
	slow, healthy := subscribe(t, h, id), subscribe(t, h, id)
	for i := 0; i <= QueueCapacity; i++ {
		message := fmt.Sprintf(`{"version":%d}`, i)
		if err := h.Publish(id, []byte(message)); err != nil {
			t.Fatal(err)
		}
		if actual := <-healthy.Messages(); actual != message {
			t.Fatalf("healthy message = %s, want %s", actual, message)
		}
	}
	select {
	case <-slow.Done():
		if !errors.Is(slow.Err(), ErrSlowConsumer) {
			t.Fatalf("slow connection error = %v", slow.Err())
		}
	default:
		t.Fatal("full queue did not stop slow connection")
	}
	select {
	case <-healthy.Done():
		t.Fatal("healthy connection stopped with slow connection")
	default:
	}
}

func TestHubShutdownRejectsNewWorkAndWaitsForCleanup(t *testing.T) {
	h := NewHub()
	s := subscribe(t, h, uuid.New())
	h.Stop()
	h.Stop()
	if _, err := h.Subscribe(uuid.New()); !errors.Is(err, ErrHubStopped) {
		t.Fatalf("subscribe after stop = %v", err)
	}
	if err := h.Publish(uuid.New(), []byte(`{}`)); !errors.Is(err, ErrHubStopped) {
		t.Fatalf("publish after stop = %v", err)
	}
	if !errors.Is(s.Err(), ErrHubStopped) {
		t.Fatalf("subscription error = %v", s.Err())
	}
	aborted := false
	s.setAbort(func() {
		// 強制切断コールバック中にHubを使用できること＝ロックを保持しないこと。
		_ = h.Publish(uuid.New(), nil)
		aborted = true
	})
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if err := h.Shutdown(ctx); !errors.Is(err, context.Canceled) || !aborted {
		t.Fatalf("shutdown before cleanup = %v, aborted = %v", err, aborted)
	}
	s.Close()
	if err := h.Shutdown(t.Context()); err != nil {
		t.Fatalf("shutdown after cleanup = %v", err)
	}
}

func TestHubLateConnectionAttachAfterForcedShutdown(t *testing.T) {
	h := NewHub()
	s := subscribe(t, h, uuid.New())
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	_ = h.Shutdown(ctx)
	aborted := false
	s.setAbort(func() { aborted = true })
	if !aborted {
		t.Fatal("connection attached after deadline was not forced closed")
	}
}

func TestHubConcurrentPublishUnsubscribeAndStop(t *testing.T) {
	h := NewHub()
	id := uuid.New()
	var workers sync.WaitGroup
	var subscribed sync.WaitGroup
	subscribed.Add(8)
	start := make(chan struct{})
	for range 8 {
		workers.Go(func() {
			first, err := h.Subscribe(id)
			if err != nil {
				t.Error(err)
				subscribed.Done()
				return
			}
			subscribed.Done()
			<-start
			_ = h.Publish(id, []byte(`{"version":0}`))
			first.Close()
			for range 100 {
				s, err := h.Subscribe(id)
				if errors.Is(err, ErrHubStopped) {
					return
				}
				if err != nil {
					t.Error(err)
					return
				}
				_ = h.Publish(id, []byte(`{"version":1}`))
				_ = s.Err()
				s.Close()
				s.Close()
			}
		})
	}
	subscribed.Wait()
	workers.Go(h.Stop)
	close(start)
	workers.Wait()
	if err := h.Shutdown(t.Context()); err != nil {
		t.Fatal(err)
	}
	if len(h.subscriptions) != 0 || len(h.connections) != 0 {
		t.Fatal("Hub retained connections after concurrent cleanup")
	}
}

func TestHubRejectsNilGuest(t *testing.T) {
	h := NewHub()
	if _, err := h.Subscribe(uuid.Nil); !errors.Is(err, ErrInvalidGuestID) {
		t.Fatalf("subscribe(nil) = %v", err)
	}
	if err := h.Publish(uuid.Nil, nil); !errors.Is(err, ErrInvalidGuestID) {
		t.Fatalf("publish(nil) = %v", err)
	}
}
