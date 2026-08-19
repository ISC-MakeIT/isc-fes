package repositoryinterfaces

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

type StoreMembersRepository interface {
	GetStoreMemberByAccountIDAndStoreID(c context.Context, accountID uuid.UUID, storeID uuid.UUID) (entities.StoreMembership, error)
	GetStoreMembersByStoreID(c context.Context, storeID uuid.UUID) ([]entities.StoreMember, error)
	RemoveStoreMemberByAccountIDAndStoreID(c context.Context, accountID uuid.UUID, storeID uuid.UUID) error
}
