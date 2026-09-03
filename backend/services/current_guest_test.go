package services

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
)

func TestCurrentGuestReturnsGuestFromContext(t *testing.T) {
	want := uuid.New()
	ctx := WithGuest(t.Context(), want)

	got, found := CurrentGuest(ctx)
	if !found {
		t.Fatal("CurrentGuest() found = false, want true")
	}
	if got != want {
		t.Errorf("CurrentGuest() = %v, want %v", got, want)
	}
}

func TestCurrentGuestWithoutGuest(t *testing.T) {
	got, found := CurrentGuest(t.Context())

	if found {
		t.Error("CurrentGuest() found = true, want false")
	}
	if got != uuid.Nil {
		t.Errorf("CurrentGuest() = %v, want uuid.Nil", got)
	}
}

func TestCurrentGuestRejectsNilID(t *testing.T) {
	ctx := WithGuest(t.Context(), uuid.Nil)

	got, found := CurrentGuest(ctx)
	if found {
		t.Error("CurrentGuest() found = true, want false")
	}
	if got != uuid.Nil {
		t.Errorf("CurrentGuest() = %v, want uuid.Nil", got)
	}
}

func TestRequireGuestReturnsGuestFromContext(t *testing.T) {
	want := uuid.New()
	ctx := WithGuest(t.Context(), want)

	got, err := RequireGuest(ctx)
	if err != nil {
		t.Fatalf("RequireGuest() error = %v", err)
	}
	if got != want {
		t.Errorf("RequireGuest() = %v, want %v", got, want)
	}
}

func TestRequireGuestWithoutGuest(t *testing.T) {
	got, err := RequireGuest(context.Background())

	if !errors.Is(err, ErrGuestNotResolved) {
		t.Fatalf("RequireGuest() error = %v, want %v", err, ErrGuestNotResolved)
	}
	if got != uuid.Nil {
		t.Errorf("RequireGuest() = %v, want uuid.Nil", got)
	}
}
