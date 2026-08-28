package menus

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/isc-makeit/isc-fes/backend/repositories/db2entities"
)

func (r *MenuRepository) GetMenuByStoreIDAndMenuID(c context.Context, storeID uuid.UUID, menuID uuid.UUID) (menus.Menu, error) {
	dbMenus, err := r.queries.GetMenuByStoreIDAndMenuID(c, sqlc.GetMenuByStoreIDAndMenuIDParams{
		ID:      menuID,
		StoreID: storeID,
	})

	return db2entities.ToMenu(dbMenus), err
}
