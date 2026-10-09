package carts

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/carts"
	"github.com/isc-makeit/isc-fes/backend/repositories"
	"github.com/isc-makeit/isc-fes/backend/repositories/db2entities"
)

func (r *CartRepository) CreateCart(c context.Context, guestID uuid.UUID, storeID uuid.UUID) (carts.Cart, error) {
	tx, qtx, err := repositories.SetupTransaction(c, r.pool, r.queries)
	if err != nil {
		return carts.Cart{}, err
	}
	defer tx.Rollback(c)
	if _, err := qtx.LockGuest(c, guestID); err != nil {
		return carts.Cart{}, err
	}
	if _, err := qtx.LockStoreForShare(c, storeID); err != nil {
		return carts.Cart{}, err
	}
	err = qtx.CreateCart(c, sqlc.CreateCartParams{
		GuestID: guestID,
		StoreID: storeID,
	})
	if err != nil {
		return carts.Cart{}, err
	}

	fullCart, err := qtx.GetCartByGuestIDAndStoreID(c, sqlc.GetCartByGuestIDAndStoreIDParams{
		GuestID: guestID,
		StoreID: storeID,
	})
	if err != nil {
		return carts.Cart{}, err
	}
	if err := tx.Commit(c); err != nil {
		return carts.Cart{}, err
	}
	return db2entities.ToCart(fullCart), nil
}
