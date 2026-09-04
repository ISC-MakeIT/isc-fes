package services

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
)

type stubGuestSession struct {
	guestID  uuid.UUID
	found    bool
	getErr   error
	bindErr  error
	boundID  uuid.UUID
	bindCall int
}

func (s *stubGuestSession) GuestID(context.Context) (uuid.UUID, bool, error) {
	return s.guestID, s.found, s.getErr
}

func (s *stubGuestSession) BindGuest(_ context.Context, guestID uuid.UUID) error {
	s.bindCall++
	s.boundID = guestID
	return s.bindErr
}

type stubGuestRepository struct {
	guestID   uuid.UUID
	err       error
	callCount int
}

func TestResolveGuestDoesNotCreateGuest(t *testing.T) {
	want := uuid.New()
	session := &stubGuestSession{guestID: want, found: true}
	repository := &stubGuestRepository{}
	service := NewGuestService(session, repository)

	got, found, err := service.ResolveGuest(t.Context())
	if err != nil {
		t.Fatalf("ResolveGuest() error = %v", err)
	}
	if !found {
		t.Fatal("ResolveGuest() found = false, want true")
	}
	if got != want {
		t.Errorf("ResolveGuest() = %v, want %v", got, want)
	}
	if repository.callCount != 0 {
		t.Errorf("CreateGuest() calls = %d, want 0", repository.callCount)
	}
}

func (r *stubGuestRepository) CreateGuest(context.Context) (uuid.UUID, error) {
	r.callCount++
	return r.guestID, r.err
}

func TestResolveOrCreateGuestReturnsExistingGuest(t *testing.T) {
	want := uuid.New()
	session := &stubGuestSession{guestID: want, found: true}
	repository := &stubGuestRepository{}
	service := NewGuestService(session, repository)

	got, err := service.ResolveOrCreateGuest(t.Context())
	if err != nil {
		t.Fatalf("ResolveOrCreateGuest() error = %v", err)
	}
	if got != want {
		t.Errorf("ResolveOrCreateGuest() = %v, want %v", got, want)
	}
	if repository.callCount != 0 {
		t.Errorf("CreateGuest() calls = %d, want 0", repository.callCount)
	}
	if session.bindCall != 0 {
		t.Errorf("BindGuest() calls = %d, want 0", session.bindCall)
	}
}

func TestResolveOrCreateGuestCreatesAndBindsGuest(t *testing.T) {
	want := uuid.New()
	session := &stubGuestSession{}
	repository := &stubGuestRepository{guestID: want}
	service := NewGuestService(session, repository)

	got, err := service.ResolveOrCreateGuest(t.Context())
	if err != nil {
		t.Fatalf("ResolveOrCreateGuest() error = %v", err)
	}
	if got != want {
		t.Errorf("ResolveOrCreateGuest() = %v, want %v", got, want)
	}
	if repository.callCount != 1 {
		t.Errorf("CreateGuest() calls = %d, want 1", repository.callCount)
	}
	if session.bindCall != 1 {
		t.Errorf("BindGuest() calls = %d, want 1", session.bindCall)
	}
	if session.boundID != want {
		t.Errorf("BindGuest() guest ID = %v, want %v", session.boundID, want)
	}
}

func TestResolveOrCreateGuestDoesNotCreateGuestWhenSessionReadFails(t *testing.T) {
	wantErr := errors.New("session unavailable")
	session := &stubGuestSession{getErr: wantErr}
	repository := &stubGuestRepository{}
	service := NewGuestService(session, repository)

	_, err := service.ResolveOrCreateGuest(t.Context())
	if !errors.Is(err, wantErr) {
		t.Fatalf("ResolveOrCreateGuest() error = %v, want wrapped %v", err, wantErr)
	}
	if repository.callCount != 0 {
		t.Errorf("CreateGuest() calls = %d, want 0", repository.callCount)
	}
}

func TestResolveOrCreateGuestDoesNotBindWhenGuestCreationFails(t *testing.T) {
	wantErr := errors.New("database unavailable")
	session := &stubGuestSession{}
	repository := &stubGuestRepository{err: wantErr}
	service := NewGuestService(session, repository)

	_, err := service.ResolveOrCreateGuest(t.Context())
	if !errors.Is(err, wantErr) {
		t.Fatalf("ResolveOrCreateGuest() error = %v, want wrapped %v", err, wantErr)
	}
	if session.bindCall != 0 {
		t.Errorf("BindGuest() calls = %d, want 0", session.bindCall)
	}
}

func TestResolveOrCreateGuestReturnsBindingError(t *testing.T) {
	wantErr := errors.New("session unavailable")
	guestID := uuid.New()
	session := &stubGuestSession{bindErr: wantErr}
	repository := &stubGuestRepository{guestID: guestID}
	service := NewGuestService(session, repository)

	got, err := service.ResolveOrCreateGuest(t.Context())
	if !errors.Is(err, wantErr) {
		t.Fatalf("ResolveOrCreateGuest() error = %v, want wrapped %v", err, wantErr)
	}
	if got != uuid.Nil {
		t.Errorf("ResolveOrCreateGuest() = %v, want uuid.Nil", got)
	}
}
