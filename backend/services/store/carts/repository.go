package carts

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/carts"
)

type CartRepository interface {
	GetCartByGuestIDAndStoreID(c context.Context, guestID uuid.UUID, storeID uuid.UUID) (carts.Cart, error)
}

type StoreRepository interface {
	GetApprovedStoreByID(ctx context.Context, storeID uuid.UUID) (entities.Store, error)
}

type GuestResolver interface {
	ResolveGuest(ctx context.Context) (guestID uuid.UUID, found bool, err error)
}
