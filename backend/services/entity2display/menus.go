package entity2display

import (
	"context"

	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/isc-makeit/isc-fes/backend/services"
)

func ToMenuDisplay(ctx context.Context, menu menus.Menu, generator services.ImageURLGenerator) (menus.MenuDisplay, error) {
	imageURL, err := generator.GenerateMenuImageURL(ctx, menu.ImageObjectKey)
	if err != nil {
		return menus.MenuDisplay{}, err
	}

	return ToMenuDisplayWithImageURL(menu, imageURL), nil
}

func ToMenuDisplayWithImageURL(menu menus.Menu, imageURL string) menus.MenuDisplay {
	return menus.MenuDisplay{
		ID:          menu.ID,
		StoreID:     menu.StoreID,
		Name:        menu.Name,
		Description: menu.Description,
		UnitPrice:   menu.UnitPrice,
		ImageURL:    imageURL,
		SoldOut:     menu.SoldOut,
		DeletedAt:   menu.DeletedAt,
		UpdatedAt:   menu.UpdatedAt,
		CreatedAt:   menu.CreatedAt,
	}
}

func ToMenuDisplays(ctx context.Context, eMenus []menus.Menu, generator services.ImageURLGenerator) ([]menus.MenuDisplay, error) {
	menuDisplays := make([]menus.MenuDisplay, len(eMenus))
	for i, menu := range eMenus {
		menuDisplay, err := ToMenuDisplay(ctx, menu, generator)
		if err != nil {
			return nil, err
		}
		menuDisplays[i] = menuDisplay
	}

	return menuDisplays, nil
}
