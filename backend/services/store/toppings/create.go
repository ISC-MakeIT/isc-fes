package toppings

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/toppings"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/jackc/pgx/v5"
)

type CreateToppingInput struct {
	StoreID   uuid.UUID
	Name      string
	UnitPrice int32
}

func (s *ToppingsService) CreateTopping(c context.Context, input CreateToppingInput) (toppings.Topping, error) {
	account, err := services.RequireAuthenticatedAccount(c)
	if err != nil {
		return toppings.Topping{}, err
	}

	_, err = s.storeRepository.GetApprovedStoreByID(c, input.StoreID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return toppings.Topping{}, services.ErrNotFound
		}
		return toppings.Topping{}, err
	}

	member, err := s.storeMemberRepository.GetStoreMembershipByAccountIDAndStoreID(c, account.ID, input.StoreID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return toppings.Topping{}, services.ErrForbidden
		}
		return toppings.Topping{}, err
	}

	if !member.IsMenuManagementAllowed() {
		return toppings.Topping{}, services.ErrForbidden
	}

	return s.toppingsRepository.CreateTopping(c, input.StoreID, input.Name, input.UnitPrice)
}
