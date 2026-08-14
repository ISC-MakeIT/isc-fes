// 店舗のメンバー招待に関するパッケージ
package invitations

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/services"
	repositoryinterfaces "github.com/isc-makeit/isc-fes/backend/services/repository_interfaces"
	"github.com/jackc/pgx/v5"
)

type StoreInvitationService struct {
	storeMembersRepository     repositoryinterfaces.StoreMembersRepository
	storeInvitationsRepository repositoryinterfaces.StoreInvitationsRepository
}

func NewStoreInvitationService(storeMembersRepository repositoryinterfaces.StoreMembersRepository, storeInvitationsRepository repositoryinterfaces.StoreInvitationsRepository) *StoreInvitationService {
	return &StoreInvitationService{
		storeMembersRepository:     storeMembersRepository,
		storeInvitationsRepository: storeInvitationsRepository,
	}
}

func (s *StoreInvitationService) CreateStoreInvitation(ctx context.Context, storeID uuid.UUID, role entities.StoreMemberRole, maxUses *int32) (entities.StoreInvitation, error) {
	account, err := services.RequireAuthenticatedAccount(ctx)
	if err != nil {
		return entities.StoreInvitation{}, err
	}

	storeMember, err := s.storeMembersRepository.GetStoreMemberByAccountIDAndStoreID(ctx, account.ID, storeID)
	if errors.Is(err, pgx.ErrNoRows) {
		return entities.StoreInvitation{}, services.ErrNotFound
	}
	if err != nil {
		return entities.StoreInvitation{}, err
	}

	if !entities.CanCreateStoreInvitation(storeMember) {
		return entities.StoreInvitation{}, services.ErrForbidden
	}

	return s.storeInvitationsRepository.CreateStoreInvitation(ctx, storeID, role, maxUses)
}
