package carts

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/carts"
	"github.com/isc-makeit/isc-fes/backend/repositories/db2entities"
)

func (r *CartRepository) CreateCart(c context.Context, guestID uuid.UUID, storeID uuid.UUID) (carts.Cart, error) {
	_, err := r.queries.CreateCart(c, sqlc.CreateCartParams{
		GuestID: guestID,
		StoreID: storeID,
	})
	if err != nil {
		return carts.Cart{}, err
	}

	fullCart, err := r.queries.GetCartByGuestIDAndStoreID(c, sqlc.GetCartByGuestIDAndStoreIDParams{
		GuestID: guestID,
		StoreID: storeID,
	})
	return db2entities.ToCart(fullCart), err
}
