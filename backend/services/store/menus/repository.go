package menus

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
)

type MenuRepository interface {
	GetMenusByStoreID(c context.Context, storeID uuid.UUID) ([]menus.Menu, error)
}
