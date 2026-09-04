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
	calls   int
}

func (r *stubCartGuestResolver) ResolveGuest(context.Context) (uuid.UUID, bool, error) {
	r.calls++
	return r.guestID, r.found, r.err
}

func TestGetCartReturnsEmptyCartWithoutGuestSession(t *testing.T) {
	storeID := uuid.New()
	cartRepository := &stubCartRepository{}
	storeRepository := &stubCartStoreRepository{}
	guestResolver := &stubCartGuestResolver{}
	service := NewCartService(
		cartRepository,
		storeRepository,
		guestResolver,
		nil,
	)

	got, err := service.GetCart(t.Context(), storeID)
	if err != nil {
		t.Fatalf("GetCart() error = %v, want nil", err)
	}
	assertEmptyCart(t, got, storeID)
	if cartRepository.calls != 0 {
		t.Errorf("GetCartByGuestIDAndStoreID() calls = %d, want 0", cartRepository.calls)
	}
	if storeRepository.calls != 1 {
		t.Errorf("GetApprovedStoreByID() calls = %d, want 1", storeRepository.calls)
	}
	if guestResolver.calls != 1 {
		t.Errorf("ResolveGuest() calls = %d, want 1", guestResolver.calls)
	}
}

func TestGetCartReturnsEmptyCartWhenRepositoryHasNoRows(t *testing.T) {
	storeID := uuid.New()
	cartRepository := &stubCartRepository{err: pgx.ErrNoRows}
	storeRepository := &stubCartStoreRepository{}
	guestResolver := &stubCartGuestResolver{guestID: uuid.New(), found: true}
	service := NewCartService(
		cartRepository,
		storeRepository,
		guestResolver,
		nil,
	)

	got, err := service.GetCart(t.Context(), storeID)
	if err != nil {
		t.Fatalf("GetCart() error = %v, want nil", err)
	}
	assertEmptyCart(t, got, storeID)
	if cartRepository.calls != 1 {
		t.Errorf("GetCartByGuestIDAndStoreID() calls = %d, want 1", cartRepository.calls)
	}
	if storeRepository.calls != 1 {
		t.Errorf("GetApprovedStoreByID() calls = %d, want 1", storeRepository.calls)
	}
	if guestResolver.calls != 1 {
		t.Errorf("ResolveGuest() calls = %d, want 1", guestResolver.calls)
	}
}

func TestGetCartReturnsNotFoundBeforeResolvingGuestWhenStoreDoesNotExist(t *testing.T) {
	cartRepository := &stubCartRepository{}
	storeRepository := &stubCartStoreRepository{err: pgx.ErrNoRows}
	guestResolver := &stubCartGuestResolver{}
	service := NewCartService(
		cartRepository,
		storeRepository,
		guestResolver,
		nil,
	)

	_, err := service.GetCart(t.Context(), uuid.New())
	if !errors.Is(err, services.ErrNotFound) {
		t.Fatalf("GetCart() error = %v, want %v", err, services.ErrNotFound)
	}
	if storeRepository.calls != 1 {
		t.Errorf("GetApprovedStoreByID() calls = %d, want 1", storeRepository.calls)
	}
	if guestResolver.calls != 0 {
		t.Errorf("ResolveGuest() calls = %d, want 0", guestResolver.calls)
	}
	if cartRepository.calls != 0 {
		t.Errorf("GetCartByGuestIDAndStoreID() calls = %d, want 0", cartRepository.calls)
	}
}

func assertEmptyCart(t *testing.T, got CartOutput, storeID uuid.UUID) {
	t.Helper()

	if got.StoreID != storeID {
		t.Errorf("GetCart().StoreID = %v, want %v", got.StoreID, storeID)
	}
	if got.Items == nil {
		t.Error("GetCart().Items = nil, want empty slice")
	} else if len(got.Items) != 0 {
		t.Errorf("len(GetCart().Items) = %d, want 0", len(got.Items))
	}
	if got.TotalAmount != 0 {
		t.Errorf("GetCart().TotalAmount = %d, want 0", got.TotalAmount)
	}
	if got.CanCheckout {
		t.Error("GetCart().CanCheckout = true, want false")
	}
}
