package toppings

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/jackc/pgx/v5"
)

func (s *ToppingsService) DeleteTopping(c context.Context, storeID, toppingID uuid.UUID) error {
	account, err := services.RequireAuthenticatedAccount(c)
	if err != nil {
		return err
	}

	_, err = s.storeRepository.GetApprovedStoreByID(c, storeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return services.ErrNotFound
		}
		return err
	}

	storeMembership, err := s.storeMemberRepository.GetStoreMembershipByAccountIDAndStoreID(c, account.ID, storeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return services.ErrForbidden
		}
		return err
	}
	if !storeMembership.IsMenuManagementAllowed() {
		return services.ErrForbidden
	}

	err = s.toppingsRepository.DeleteTopping(c, storeID, toppingID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return services.ErrNotFound
		}
		return err
	}

	return nil
}
