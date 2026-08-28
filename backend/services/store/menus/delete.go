package menus

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/jackc/pgx/v5"
)

func (s *MenuService) DeleteMenuByStoreIDAndMenuID(c context.Context, storeID uuid.UUID, menuID uuid.UUID) error {
	account, err := services.RequireAuthenticatedAccount(c)
	if err != nil {
		return err
	}

	// 認可
	_, err = s.storeRepository.GetApprovedStoreByID(c, storeID)
	// 未承認 || そもそも店舗が存在しない場合は 404
	if errors.Is(err, pgx.ErrNoRows) {
		return services.ErrNotFound
	}
	if err != nil {
		return err
	}

	storeMembership, err := s.storeMemberRepository.GetStoreMembershipByAccountIDAndStoreID(c, account.ID, storeID)
	if errors.Is(err, pgx.ErrNoRows) {
		return services.ErrForbidden
	}
	if err != nil {
		return err
	}
	if !storeMembership.IsMenuManagementAllowed() {
		return services.ErrForbidden
	}

	deleteCount, err := s.menuRepository.DeleteMenuByStoreIDAndMenuID(c, storeID, menuID)
	if err != nil {
		return err
	}
	if deleteCount == 0 {
		return services.ErrNotFound
	}

	return nil
}
