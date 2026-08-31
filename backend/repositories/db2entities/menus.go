package db2entities

import (
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/isc-makeit/isc-fes/backend/utils"
)

func ToMenu(menu sqlc.Menu) menus.Menu {
	return menus.Menu{
		ID:             menu.ID,
		StoreID:        menu.StoreID,
		Name:           menu.Name,
		Description:    menu.Description,
		UnitPrice:      menu.UnitPrice,
		ImageObjectKey: menus.MenuImageObjectKey(menu.ImageObjectKey),
		SoldOut:        menu.SoldOut,
		DeletedAt:      utils.TimestamptzToTimePtr(menu.DeletedAt),
		UpdatedAt:      menu.UpdatedAt.Time,
		CreatedAt:      menu.CreatedAt.Time,
	}
}

func ToMenus(menus []sqlc.Menu) []menus.Menu {
	return utils.Map(menus, ToMenu)
}
