package carts

import (
	"context"
	"errors"

	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/isc-makeit/isc-fes/backend/utils"
	"github.com/jackc/pgx/v5"
)

func (s CartService) UpdateCartByStoreID(c context.Context, input UpdateCartInput) (CartOutput, error) {
	guestID, err := s.guestResolver.ResolveOrCreateGuest(c)
	if err != nil {
		return CartOutput{}, err
	}

	store, err := s.storeRepository.GetApprovedStoreByID(c, input.StoreID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return CartOutput{}, services.ErrNotFound // 店舗が存在しない場合は404を返す
		}
		return CartOutput{}, err
	}

	cart, err := s.cartRepository.GetCartByGuestIDAndStoreID(c, guestID, input.StoreID)
	if errors.Is(err, pgx.ErrNoRows) {
		// カートが存在しない場合は新しいカートを作成する
		cart, err = s.cartRepository.CreateCart(c, guestID, input.StoreID)
	}
	if err != nil {
		return CartOutput{}, err
	}

	cart, err = s.cartRepository.UpdateCart(c, UpdateCartRepositoryInput{
		GuestID:         guestID,
		StoreID:         input.StoreID,
		ExpectedVersion: input.ExpectedVersion,
		Items: utils.Map(input.Items, func(i UpdateCartItemInput) UpdateCartItemRepositoryInput {
			return UpdateCartItemRepositoryInput{
				ID:         i.ID,
				MenuID:     i.MenuID,
				Quantity:   i.Quantity,
				ToppingIDs: i.ToppingIds,
			}
		}),
	})

	if errors.Is(err, ErrCartConflict) {
		return CartOutput{}, services.ErrConflict // カートのバージョンが競合した場合は409を返す
	}
	if errors.Is(err, ErrCartItemInvalid) {
		return CartOutput{}, services.ErrInvalidInput // カートアイテムが不正な場合は400を返す
	}
	if err != nil {
		return CartOutput{}, err
	}

	return ToCartOutput(c, cart, store, s.imageURLGenerator)
}
