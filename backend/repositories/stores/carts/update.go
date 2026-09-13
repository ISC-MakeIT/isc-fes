package carts

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/carts"
	"github.com/isc-makeit/isc-fes/backend/repositories"
	"github.com/isc-makeit/isc-fes/backend/repositories/db2entities"
	carts_service "github.com/isc-makeit/isc-fes/backend/services/store/carts"
	"github.com/isc-makeit/isc-fes/backend/utils"
	"github.com/jackc/pgx/v5"
)

func (r *CartRepository) UpdateCart(c context.Context, input carts_service.UpdateCartRepositoryInput) (carts.Cart, error) {
	tx, qtx, err := repositories.SetupTransaction(c, r.pool, r.queries)
	if err != nil {
		return carts.Cart{}, err
	}
	defer tx.Rollback(c)

	bv, err := qtx.BumpCartVersion(c, sqlc.BumpCartVersionParams{
		GuestID:         input.GuestID,
		StoreID:         input.StoreID,
		ExpectedVersion: input.ExpectedVersion,
	})
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return carts.Cart{}, carts_service.ErrCartConflict
		}
		return carts.Cart{}, err
	}

	input = injectCartItemID(input)

	// カートアイテムを更新する
	itemIDs := utils.Map(input.Items, func(i carts_service.UpdateCartItemRepositoryInput) uuid.UUID {
		return *i.ID
	})
	menuIDs := utils.Map(input.Items, func(i carts_service.UpdateCartItemRepositoryInput) uuid.UUID {
		return i.MenuID
	})
	quantities := utils.Map(input.Items, func(i carts_service.UpdateCartItemRepositoryInput) int32 {
		return i.Quantity
	})
	affected, err := qtx.UpsertCartItems(c, sqlc.UpsertCartItemsParams{
		CartID:     bv.ID,
		StoreID:    input.StoreID,
		ItemIds:    itemIDs,
		MenuIds:    menuIDs,
		Quantities: quantities,
	})
	if err != nil {
		return carts.Cart{}, err
	}
	if affected != int64(len(input.Items)) {
		return carts.Cart{}, carts_service.ErrCartItemInvalid
	}

	err = qtx.DeleteCartItemsNotIn(c, sqlc.DeleteCartItemsNotInParams{
		CartID:           bv.ID,
		RemainingItemIds: itemIDs,
	})
	if err != nil {
		return carts.Cart{}, err
	}

	// カートアイテムのトッピングを更新する
	cartItemIDs := []uuid.UUID{}
	toppingIDs := []uuid.UUID{}
	for i := 0; i < len(input.Items); i++ {
		for j := 0; j < len(input.Items[i].ToppingIDs); j++ {
			cartItemIDs = append(cartItemIDs, *input.Items[i].ID)
			toppingIDs = append(toppingIDs, input.Items[i].ToppingIDs[j])
		}
	}
	err = qtx.InsertCartItemToppingsIfNotExists(c, sqlc.InsertCartItemToppingsIfNotExistsParams{
		CartID:      bv.ID,
		StoreID:     input.StoreID,
		CartItemIds: cartItemIDs,
		ToppingIds:  toppingIDs,
	})
	if err != nil {
		return carts.Cart{}, err
	}
	err = qtx.DeleteCartItemToppingsNotIn(c, sqlc.DeleteCartItemToppingsNotInParams{
		CartID:      bv.ID,
		StoreID:     input.StoreID,
		CartItemIds: cartItemIDs,
		ToppingIds:  toppingIDs,
	})
	if err != nil {
		return carts.Cart{}, err
	}

	fullRawCart, err := qtx.GetCartByGuestIDAndStoreID(c, sqlc.GetCartByGuestIDAndStoreIDParams{
		GuestID: input.GuestID,
		StoreID: input.StoreID,
	})
	if err != nil {
		return carts.Cart{}, err
	}
	fullCart := db2entities.ToCart(fullRawCart)

	err = tx.Commit(c)
	if err != nil {
		return carts.Cart{}, err
	}

	return fullCart, nil
}

// 新しく作成されたカートアイテムに ID を作成して注入する
func injectCartItemID(input carts_service.UpdateCartRepositoryInput) carts_service.UpdateCartRepositoryInput {
	for i := 0; i < len(input.Items); i++ {
		if input.Items[i].ID == nil {
			id := uuid.New()
			input.Items[i].ID = &id
		}
	}
	return input
}
