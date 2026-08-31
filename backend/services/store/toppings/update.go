package toppings

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/toppings"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/jackc/pgx/v5"
)

type UpdateToppingInput struct {
	Name      string
	UnitPrice int32
	SoldOut   bool
}

func (s *ToppingsService) UpdateToppingByStoreIDAndToppingID(c context.Context, storeID, toppingID uuid.UUID, input UpdateToppingInput) (toppings.Topping, error) {
	account, err := services.RequireAuthenticatedAccount(c)
	if err != nil {
		return toppings.Topping{}, err
	}

	_, err = s.storeRepository.GetApprovedStoreByID(c, storeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return toppings.Topping{}, services.ErrNotFound
		}
		return toppings.Topping{}, err
	}

	membership, err := s.storeMemberRepository.GetStoreMembershipByAccountIDAndStoreID(c, account.ID, storeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return toppings.Topping{}, services.ErrForbidden
		}
		return toppings.Topping{}, err
	}
	if !membership.IsMenuManagementAllowed() {
		return toppings.Topping{}, services.ErrForbidden
	}

	topping, err := s.toppingsRepository.UpdateToppingByToppingIDAndStoreID(c, toppingID, storeID, UpdateToppingRepositoryInput{
		Name:      input.Name,
		UnitPrice: input.UnitPrice,
		SoldOut:   input.SoldOut,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return toppings.Topping{}, services.ErrNotFound
	}
	return topping, err
}
