package carts

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/jackc/pgx/v5"
)

type CartService struct {
	cartRepository    CartRepository
	storeRepository   StoreRepository
	guestResolver     GuestResolver
	imageURLGenerator services.ImageURLGenerator
}

func NewCartService(
	cartRepository CartRepository,
	storeRepository StoreRepository,
	guestResolver GuestResolver,
	imageURLGenerator services.ImageURLGenerator,
) *CartService {
	return &CartService{
		cartRepository:    cartRepository,
		storeRepository:   storeRepository,
		guestResolver:     guestResolver,
		imageURLGenerator: imageURLGenerator,
	}
}

func (s *CartService) GetCart(c context.Context, storeID uuid.UUID) (CartOutput, error) {
	guestID, found, err := s.guestResolver.ResolveGuest(c)
	if err != nil {
		return CartOutput{}, err
	}
	if !found {
		return CartOutput{}, services.ErrNotFound
	}

	store, err := s.storeRepository.GetApprovedStoreByID(c, storeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return CartOutput{}, services.ErrNotFound
		}
		return CartOutput{}, err
	}

	cart, err := s.cartRepository.GetCartByGuestIDAndStoreID(c, guestID, storeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return CartOutput{}, services.ErrNotFound
		}
		return CartOutput{}, err
	}

	return ToCartOutput(c, cart, store, s.imageURLGenerator)
}
