package repositoryinterfaces

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

type StoreInvitationsRepository interface {
	GetStoreInvitationByID(ctx context.Context, invitationID uuid.UUID) (entities.StoreInvitation, error)
	CreateStoreInvitation(ctx context.Context, storeID uuid.UUID, Role entities.StoreMemberRole, MaxUses *int32) (entities.StoreInvitation, error)
	AcceptStoreInvitation(ctx context.Context, invitationID uuid.UUID, accountID uuid.UUID) (entities.StoreInvitation, error)
}

var (
	ErrStoreMemberAlreadyExists = errors.New("store member already exists")
)
