package repositoryinterfaces

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

type StoreInvitationsRepository interface {
	CreateStoreInvitation(ctx context.Context, storeID uuid.UUID, Role entities.StoreMemberRole, MaxUses *int32) (entities.StoreInvitation, error)
}
