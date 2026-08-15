package menus

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/isc-makeit/isc-fes/backend/repositories/db2entities"
	menuService "github.com/isc-makeit/isc-fes/backend/services/store/menus"
)

type MenuRepository struct {
	queries *sqlc.Queries
}

func NewMenuRepository(queries *sqlc.Queries) *MenuRepository {
	return &MenuRepository{
		queries: queries,
	}
}

func (r *MenuRepository) GetMenusByStoreID(c context.Context, storeID uuid.UUID) ([]menus.Menu, error) {
	dbMenus, err := r.queries.GetMenusByStoreID(c, storeID)

	return db2entities.ToMenus(dbMenus), err
}

var _ menuService.MenuRepository = (*MenuRepository)(nil)
