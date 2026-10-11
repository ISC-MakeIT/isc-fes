package app

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/realtime"
)

func TestRunStopsHubWhenHTTPServerFails(t *testing.T) {
	hub := realtime.NewHub()
	s, err := hub.Subscribe(uuid.New())
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	go func() {
		<-s.Done()
		s.Close()
	}()
	application := &App{
		httpServer:   &http.Server{Addr: "invalid-address"},
		dependencies: &dependencies{ordersHub: hub},
	}
	ctx, cancel := context.WithTimeout(t.Context(), time.Second)
	defer cancel()
	if err := application.Run(ctx); err == nil {
		t.Fatal("Run did not report HTTP listen failure")
	}
	if _, err := hub.Subscribe(uuid.New()); !errors.Is(err, realtime.ErrHubStopped) {
		t.Fatalf("Hub still accepts connections after Run: %v", err)
	}
}

func TestRunStopsHubWhenContextIsCanceled(t *testing.T) {
	hub := realtime.NewHub()
	application := &App{
		httpServer:   &http.Server{Addr: "127.0.0.1:0"},
		dependencies: &dependencies{ordersHub: hub},
	}
	ctx, cancel := context.WithCancel(t.Context())
	cancel()
	if err := application.Run(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := hub.Subscribe(uuid.New()); !errors.Is(err, realtime.ErrHubStopped) {
		t.Fatalf("Hub still accepts connections after cancellation: %v", err)
	}
}
