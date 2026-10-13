package members

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/services"
	repositoryinterfaces "github.com/isc-makeit/isc-fes/backend/services/repository_interfaces"
	"github.com/jackc/pgx/v5"
)

type StoreMemberService struct {
	storeRepository       services.StoreReader
	storeMemberRepository repositoryinterfaces.StoreMembersRepository
}

func NewStoreMemberService(storeRepository services.StoreReader, storeMemberRepository repositoryinterfaces.StoreMembersRepository) *StoreMemberService {
	return &StoreMemberService{
		storeRepository:       storeRepository,
		storeMemberRepository: storeMemberRepository,
	}
}

func (s *StoreMemberService) GetStoreMembersByStoreID(ctx context.Context, storeID uuid.UUID) ([]entities.StoreMember, error) {
	account, err := services.RequireAuthenticatedAccount(ctx)
	if err != nil {
		return nil, err
	}

	if _, err := s.storeRepository.GetStoreByID(ctx, storeID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, services.ErrNotFound
		}
		return nil, err
	}

	_, err = services.StoreMembershipForAuthorization(ctx, s.storeMemberRepository, account, storeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, services.ErrNotFound
		}
		return nil, err
	}

	return s.storeMemberRepository.GetStoreMembersByStoreID(ctx, storeID)
}

func (s *StoreMemberService) GetStoreMemberByAccountIDAndStoreID(ctx context.Context, accountID, storeID uuid.UUID) (entities.StoreMember, error) {
	account, err := services.RequireAuthenticatedAccount(ctx)
	if err != nil {
		return entities.StoreMember{}, err
	}

	if _, err := s.storeRepository.GetStoreByID(ctx, storeID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return entities.StoreMember{}, services.ErrNotFound
		}
		return entities.StoreMember{}, err
	}

	if account.ID != accountID && account.Role != entities.RoleAdmin {
		// 自分以外のメンバー情報を取得する場合は、店舗のメンバーである必要がある
		_, err = services.StoreMembershipForAuthorization(ctx, s.storeMemberRepository, account, storeID)
		if err != nil {
			if errors.Is(err, pgx.ErrNoRows) {
				return entities.StoreMember{}, services.ErrNotFound
			}
			return entities.StoreMember{}, err
		}
	}

	member, err := s.storeMemberRepository.GetStoreMemberByAccountIDAndStoreID(ctx, accountID, storeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return entities.StoreMember{}, services.ErrNotFound
		}
		return entities.StoreMember{}, err
	}

	return member, nil
}

func (s *StoreMemberService) RemoveStoreMemberByAccountIDAndStoreID(ctx context.Context, accountID, storeID uuid.UUID) error {
	authorizedAccount, err := services.RequireAuthenticatedAccount(ctx)
	if err != nil {
		return err
	}

	if _, err := s.storeRepository.GetStoreByID(ctx, storeID); err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return services.ErrNotFound
		}
		return err
	}

	authorizedMember, err := services.StoreMembershipForAuthorization(ctx, s.storeMemberRepository, authorizedAccount, storeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return services.ErrNotFound
		}
		return err
	}

	membership, err := s.storeMemberRepository.GetStoreMembershipByAccountIDAndStoreID(ctx, accountID, storeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return services.ErrNotFound
		}
		return err
	}

	// マネージャーは削除できない
	if membership.Role == entities.StoreMemberRoleManager {
		return services.ErrForbidden
	}

	if !authorizedMember.IsMemberManagementAllowed() {
		return services.ErrForbidden
	}

	return s.storeMemberRepository.RemoveStoreMemberByAccountIDAndStoreID(ctx, accountID, storeID)
}
