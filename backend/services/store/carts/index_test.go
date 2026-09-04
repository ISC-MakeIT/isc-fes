package carts

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	cartentities "github.com/isc-makeit/isc-fes/backend/domains/entities/carts"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/jackc/pgx/v5"
)

type stubCartRepository struct {
	cart  cartentities.Cart
	err   error
	calls int
}

func (r *stubCartRepository) GetCartByGuestIDAndStoreID(context.Context, uuid.UUID, uuid.UUID) (cartentities.Cart, error) {
	r.calls++
	return r.cart, r.err
}

type stubCartStoreRepository struct {
	err   error
	calls int
}

func (r *stubCartStoreRepository) GetApprovedStoreByID(context.Context, uuid.UUID) (entities.Store, error) {
	r.calls++
	return entities.Store{}, r.err
}

type stubCartGuestResolver struct {
	guestID uuid.UUID
	found   bool
	err     error
}

func (r *stubCartGuestResolver) ResolveGuest(context.Context) (uuid.UUID, bool, error) {
	return r.guestID, r.found, r.err
}

func TestGetCartReturnsNotFoundWithoutGuestSession(t *testing.T) {
	cartRepository := &stubCartRepository{}
	storeRepository := &stubCartStoreRepository{}
	service := NewCartService(
		cartRepository,
		storeRepository,
		&stubCartGuestResolver{},
		nil,
	)

	_, err := service.GetCart(t.Context(), uuid.New())
	if !errors.Is(err, services.ErrNotFound) {
		t.Fatalf("GetCart() error = %v, want %v", err, services.ErrNotFound)
	}
	if cartRepository.calls != 0 {
		t.Errorf("GetCartByGuestIDAndStoreID() calls = %d, want 0", cartRepository.calls)
	}
	if storeRepository.calls != 0 {
		t.Errorf("GetApprovedStoreByID() calls = %d, want 0", storeRepository.calls)
	}
}

func TestGetCartConvertsRepositoryNoRowsToNotFound(t *testing.T) {
	cartRepository := &stubCartRepository{err: pgx.ErrNoRows}
	storeRepository := &stubCartStoreRepository{}
	service := NewCartService(
		cartRepository,
		storeRepository,
		&stubCartGuestResolver{guestID: uuid.New(), found: true},
		nil,
	)

	_, err := service.GetCart(t.Context(), uuid.New())
	if !errors.Is(err, services.ErrNotFound) {
		t.Fatalf("GetCart() error = %v, want %v", err, services.ErrNotFound)
	}
	if cartRepository.calls != 1 {
		t.Errorf("GetCartByGuestIDAndStoreID() calls = %d, want 1", cartRepository.calls)
	}
}
