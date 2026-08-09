package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/internal/domain/entities"
	"github.com/jackc/pgx/v5"
)

type StoreMembershipApplicationsRepository interface {
	GetStoreMembershipApplicationsByStoreID(ctx context.Context, storeID uuid.UUID) ([]entities.StoreMembershipApplication, error)
}

type StoreMembershipApplicationsService struct {
	storeRepository                       StoreRepository
	storeMembershipApplicationsRepository StoreMembershipApplicationsRepository
	accountRepository                     AccountRepository
	sessionManager                        SessionManager
}

func (s *StoreMembershipApplicationsService) GetStoreMembershipApplicationsByStoreID(ctx context.Context, storeID uuid.UUID) ([]entities.StoreMembershipApplication, error) {
	accountID, err := s.sessionManager.AccountID(ctx)
	if err != nil {
		return []entities.StoreMembershipApplication{}, ErrUnauthenticated
	}

	account, err := s.accountRepository.GetAccountByID(ctx, accountID)
	if err != nil {
		return []entities.StoreMembershipApplication{}, ErrUnauthenticated
	}

	accountStoreMemberships, err := s.storeRepository.GetStoreMembershipsByAccountID(ctx, accountID)
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

func NewStoreMembershipApplicationsService(storeRepository StoreRepository, storeMembershipApplicationsRepository StoreMembershipApplicationsRepository, accountRepository AccountRepository, sessionManager SessionManager) *StoreMembershipApplicationsService {
	return &StoreMembershipApplicationsService{
		storeRepository:                       storeRepository,
		storeMembershipApplicationsRepository: storeMembershipApplicationsRepository,
		accountRepository:                     accountRepository,
		sessionManager:                        sessionManager,
	}
}
