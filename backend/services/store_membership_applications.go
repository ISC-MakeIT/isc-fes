package services

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/jackc/pgx/v5"
)

type StoreMembershipApplicationsRepository interface {
	GetStoreMembershipApplicationsByStoreID(ctx context.Context, storeID uuid.UUID) ([]entities.StoreMembershipApplication, error)
	GetStoreMembershipApplicationsByAccountID(ctx context.Context, accountID uuid.UUID) ([]entities.StoreMembershipApplication, error)
}

type StoreMembershipApplicationsService struct {
	storeRepository                       StoreRepository
	storeMembershipApplicationsRepository StoreMembershipApplicationsRepository
}

func (s *StoreMembershipApplicationsService) GetMyStoreMembershipApplications(ctx context.Context) ([]entities.StoreMembershipApplication, error) {
	account, err := RequireAuthenticatedAccount(ctx)
	if err != nil {
		return []entities.StoreMembershipApplication{}, err
	}

	myStoreMembershipApplications, err := s.storeMembershipApplicationsRepository.GetStoreMembershipApplicationsByAccountID(ctx, account.ID)
	if err != nil {
		return []entities.StoreMembershipApplication{}, err
	}

	return myStoreMembershipApplications, nil
}

func (s *StoreMembershipApplicationsService) GetStoreMembershipApplicationsByStoreID(ctx context.Context, storeID uuid.UUID) ([]entities.StoreMembershipApplication, error) {
	account, err := RequireAuthenticatedAccount(ctx)
	if err != nil {
		return []entities.StoreMembershipApplication{}, err
	}

	accountStoreMemberships, err := s.storeRepository.GetStoreMembershipsByAccountID(ctx, account.ID)
	if err != nil {
		return []entities.StoreMembershipApplication{}, ErrForbidden
	}

	store, err := s.storeRepository.GetStoreByID(ctx, storeID)
	if err == pgx.ErrNoRows {
		return []entities.StoreMembershipApplication{}, ErrNotFound
	}
	if err != nil {
		return []entities.StoreMembershipApplication{}, err
	}

	if !entities.CanSeeStoreMembershipApplications(account, store, accountStoreMemberships) {
		return []entities.StoreMembershipApplication{}, ErrForbidden
	}

	return s.storeMembershipApplicationsRepository.GetStoreMembershipApplicationsByStoreID(ctx, storeID)
}

func NewStoreMembershipApplicationsService(
	storeRepository StoreRepository,
	storeMembershipApplicationsRepository StoreMembershipApplicationsRepository,
) *StoreMembershipApplicationsService {
	return &StoreMembershipApplicationsService{
		storeRepository:                       storeRepository,
		storeMembershipApplicationsRepository: storeMembershipApplicationsRepository,
	}
}
