package toppings

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/toppings"
	"github.com/isc-makeit/isc-fes/backend/services"
	repositoryinterfaces "github.com/isc-makeit/isc-fes/backend/services/repository_interfaces"
	"github.com/jackc/pgx/v5"
)

type ToppingsService struct {
	toppingsRepository    ToppingsRepository
	storeMemberRepository repositoryinterfaces.StoreMembersRepository
	storeRepository       services.StoreRepository
}

func NewToppingsService(toppingsRepository ToppingsRepository, storeMemberRepository repositoryinterfaces.StoreMembersRepository, storeRepository services.StoreRepository) *ToppingsService {
	return &ToppingsService{
		toppingsRepository:    toppingsRepository,
		storeMemberRepository: storeMemberRepository,
		storeRepository:       storeRepository,
	}
}

func (s *ToppingsService) GetToppingsByStoreID(c context.Context, storeID uuid.UUID) ([]toppings.Topping, error) {
	account, err := services.RequireAuthenticatedAccount(c)
	if err != nil {
		return nil, err
	}

	_, err = s.storeRepository.GetApprovedStoreByID(c, storeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, services.ErrNotFound
		}
		return nil, err
	}

	_, err = s.storeMemberRepository.GetStoreMemberByAccountIDAndStoreID(c, account.ID, storeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, services.ErrForbidden
		}
		return nil, err
	}

	toppings, err := s.toppingsRepository.GetToppingsByStoreID(c, storeID)
	return toppings, err
}
