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
	store, err := s.storeRepository.GetApprovedStoreByID(c, storeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return CartOutput{}, services.ErrNotFound // 店舗が存在しない場合は404を返す
		}
		return CartOutput{}, err
	}

	guestID, found, err := s.guestResolver.ResolveGuest(c)
	if err != nil {
		return CartOutput{}, err
	}
	if !found {
		return emptyCartOutput(storeID), nil // ゲストセッションがない場合は空のカートを返す
	}

	cart, err := s.cartRepository.GetCartByGuestIDAndStoreID(c, guestID, storeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return emptyCartOutput(storeID), nil // カートが存在しない場合は空のカートを返す
		}
		return CartOutput{}, err
	}

	return ToCartOutput(c, cart, store, s.imageURLGenerator)
}

func emptyCartOutput(storeID uuid.UUID) CartOutput {
	return CartOutput{
		StoreID:     storeID,
		Items:       []CartItemOutput{},
		TotalAmount: 0,
		CanCheckout: false,
	}
}
