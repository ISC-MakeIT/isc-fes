package invitations

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	repositoryinterfaces "github.com/isc-makeit/isc-fes/backend/services/repository_interfaces"
)

type StoreInvitationRepository struct {
	queries *sqlc.Queries
}

func NewStoreInvitationRepository(queries *sqlc.Queries) *StoreInvitationRepository {
	return &StoreInvitationRepository{
		queries: queries,
	}
}

func (r *StoreInvitationRepository) CreateStoreInvitation(ctx context.Context, storeID uuid.UUID, Role entities.StoreMemberRole, MaxUses *int32) (entities.StoreInvitation, error) {
	inv, err := r.queries.CreateStoreInvitation(ctx, sqlc.CreateStoreInvitationParams{
		StoreID: storeID,
		Role:    sqlc.StoreMemberRole(Role),
		MaxUses: MaxUses,
	})
	return toStoreInvitation(inv), err
}

func toStoreInvitation(dbStoreInvitation sqlc.StoreInvitation) entities.StoreInvitation {
	return entities.StoreInvitation{
		ID:        dbStoreInvitation.ID,
		StoreID:   dbStoreInvitation.StoreID,
		Role:      entities.StoreMemberRole(dbStoreInvitation.Role),
		MaxUses:   dbStoreInvitation.MaxUses,
		UseCount:  dbStoreInvitation.UseCount,
		UpdatedAt: dbStoreInvitation.UpdatedAt.Time,
		CreatedAt: dbStoreInvitation.CreatedAt.Time,
	}
}

var _ repositoryinterfaces.StoreInvitationsRepository = (*StoreInvitationRepository)(nil)
