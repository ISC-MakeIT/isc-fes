package members

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	repositoryinterfaces "github.com/isc-makeit/isc-fes/backend/services/repository_interfaces"
)

type StoreMemberRepository struct {
	queries *sqlc.Queries
}

func NewStoreMemberRepository(queries *sqlc.Queries) *StoreMemberRepository {
	return &StoreMemberRepository{
		queries: queries,
	}
}

func (r *StoreMemberRepository) GetStoreMemberByAccountIDAndStoreID(c context.Context, accountID uuid.UUID, storeID uuid.UUID) (entities.StoreMember, error) {
	dbStoreMember, err := r.queries.GetStoreMemberByAccountIDAndStoreID(c, sqlc.GetStoreMemberByAccountIDAndStoreIDParams{
		AccountID: accountID,
		StoreID:   storeID,
	})
	return toStoreMember(dbStoreMember), err
}

func toStoreMember(dbStoreMember sqlc.StoreMember) entities.StoreMember {
	return entities.StoreMember{
		AccountID: dbStoreMember.AccountID,
		StoreID:   dbStoreMember.StoreID,
		Role:      entities.StoreMemberRole(dbStoreMember.Role),
		JoinedAt:  dbStoreMember.JoinedAt.Time,
	}
}

var _ repositoryinterfaces.StoreMembersRepository = (*StoreMemberRepository)(nil)
