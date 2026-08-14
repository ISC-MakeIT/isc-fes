package repositoryinterfaces

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

type StoreMembersRepository interface {
	GetStoreMemberByAccountIDAndStoreID(c context.Context, accountID uuid.UUID, storeID uuid.UUID) (entities.StoreMember, error)
}
