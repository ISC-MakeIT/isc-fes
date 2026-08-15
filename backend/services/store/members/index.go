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
	storeMemberRepository repositoryinterfaces.StoreMembersRepository
}

func NewStoreMemberService(storeMemberRepository repositoryinterfaces.StoreMembersRepository) *StoreMemberService {
	return &StoreMemberService{
		storeMemberRepository: storeMemberRepository,
	}
}

func (s *StoreMemberService) GetStoreMembersByStoreID(ctx context.Context, storeID uuid.UUID) ([]entities.StoreMember, error) {
	account, err := services.RequireAuthenticatedAccount(ctx)
	if err != nil {
		return nil, err
	}

	_, err = s.storeMemberRepository.GetStoreMemberByAccountIDAndStoreID(ctx, account.ID, storeID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, services.ErrNotFound
		}
		return nil, err
	}

	return s.storeMemberRepository.GetStoreMembersByStoreID(ctx, storeID)
}
