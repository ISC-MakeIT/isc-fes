package db2entities

import (
	"context"

	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/isc-makeit/isc-fes/backend/services"
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
		DeletedAt:      &menu.DeletedAt.Time,
		UpdatedAt:      menu.UpdatedAt.Time,
		CreatedAt:      menu.CreatedAt.Time,
	}
}

func ToMenus(menus []sqlc.Menu) []menus.Menu {
	return utils.Map(menus, ToMenu)
}

func ToMenuDisplay(ctx context.Context, sqlcMenu sqlc.Menu, generator services.ImageURLGenerator) (menus.MenuDisplay, error) {
	menu := ToMenu(sqlcMenu)
	imgUrl, err := generator.GenerateMenuImageURL(ctx, menu.ImageObjectKey)
	if err != nil {
		return menus.MenuDisplay{}, err
	}

	return menus.MenuDisplay{
		ID:          menu.ID,
		StoreID:     menu.StoreID,
		Name:        menu.Name,
		Description: menu.Description,
		UnitPrice:   menu.UnitPrice,
		ImageURL:    imgUrl,
		SoldOut:     menu.SoldOut,
		DeletedAt:   menu.DeletedAt,
		UpdatedAt:   menu.UpdatedAt,
		CreatedAt:   menu.CreatedAt,
	}, nil
}

func ToMenuDisplays(ctx context.Context, sqlcMenus []sqlc.Menu, generator services.ImageURLGenerator) ([]menus.MenuDisplay, error) {
	menuDisplays := make([]menus.MenuDisplay, len(sqlcMenus))
	for i, sqlcMenu := range sqlcMenus {
		menuDisplay, err := ToMenuDisplay(ctx, sqlcMenu, generator)
		if err != nil {
			return nil, err
		}
		menuDisplays[i] = menuDisplay
	}

	return menuDisplays, nil
}
