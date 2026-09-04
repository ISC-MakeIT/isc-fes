package carts

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/carts"
	"github.com/isc-makeit/isc-fes/backend/repositories/db2entities"
	"github.com/jackc/pgx/v5"
)

func (r *CartRepository) GetCartByGuestIDAndStoreID(c context.Context, guestID uuid.UUID, storeID uuid.UUID) (carts.Cart, error) {
	dbRows, err := r.queries.GetCartByGuestIDAndStoreID(c, sqlc.GetCartByGuestIDAndStoreIDParams{
		GuestID: guestID,
		StoreID: storeID,
	})
	if err != nil {
		return carts.Cart{}, err
	}
	if len(dbRows) == 0 {
		return carts.Cart{}, pgx.ErrNoRows
	}

	return db2entities.ToCart(dbRows), nil
}
