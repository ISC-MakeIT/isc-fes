package carts

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/carts"
)

type UpdateCartRepositoryInput struct {
	GuestID         uuid.UUID
	StoreID         uuid.UUID
	ExpectedVersion int32
	Items           []UpdateCartItemRepositoryInput
}

type UpdateCartItemRepositoryInput struct {
	ID         *uuid.UUID
	MenuID     uuid.UUID
	Quantity   int32
	ToppingIDs []uuid.UUID
}

// カートのバージョンが競合した場合に返すエラー
var ErrCartConflict = errors.New("cart version conflict")
var ErrCartItemInvalid = errors.New("cart item invalid")

type CartRepository interface {
	GetCartByGuestIDAndStoreID(c context.Context, guestID uuid.UUID, storeID uuid.UUID) (carts.Cart, error)
	CreateCart(c context.Context, guestID uuid.UUID, storeID uuid.UUID) (carts.Cart, error)
	UpdateCart(c context.Context, input UpdateCartRepositoryInput) (carts.Cart, error)
}

type StoreRepository interface {
	GetApprovedStoreByID(ctx context.Context, storeID uuid.UUID) (entities.Store, error)
}

type GuestResolver interface {
	ResolveGuest(ctx context.Context) (guestID uuid.UUID, found bool, err error)
	ResolveOrCreateGuest(ctx context.Context) (uuid.UUID, error)
}
