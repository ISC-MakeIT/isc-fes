package db2entities

import (
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/toppings"
	"github.com/isc-makeit/isc-fes/backend/utils"
)

func ToTopping(topping sqlc.Topping) toppings.Topping {
	return toppings.Topping{
		ID:        topping.ID,
		StoreID:   topping.StoreID,
		Name:      topping.Name,
		UnitPrice: topping.UnitPrice,
		SoldOut:   topping.SoldOut,
		DeletedAt: utils.TimestamptzToTimePtr(topping.DeletedAt),
		UpdatedAt: topping.UpdatedAt.Time,
		CreatedAt: topping.CreatedAt.Time,
	}
}

func ToToppings(toppings []sqlc.Topping) []toppings.Topping {
	return utils.Map(toppings, ToTopping)
}
