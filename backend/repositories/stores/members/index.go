package members

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	repositoryinterfaces "github.com/isc-makeit/isc-fes/backend/services/repository_interfaces"
	"github.com/isc-makeit/isc-fes/backend/utils"
)

type StoreMemberRepository struct {
	queries *sqlc.Queries
}

func NewStoreMemberRepository(queries *sqlc.Queries) *StoreMemberRepository {
	return &StoreMemberRepository{
		queries: queries,
	}
}

func (r *StoreMemberRepository) GetStoreMembershipByAccountIDAndStoreID(c context.Context, accountID uuid.UUID, storeID uuid.UUID) (entities.StoreMembership, error) {
	dbStoreMember, err := r.queries.GetStoreMembershipByAccountIDAndStoreID(c, sqlc.GetStoreMembershipByAccountIDAndStoreIDParams{
		AccountID: accountID,
		StoreID:   storeID,
	})
	return toStoreMembership(dbStoreMember), err
}

func (r *StoreMemberRepository) GetStoreMemberByAccountIDAndStoreID(c context.Context, accountID uuid.UUID, storeID uuid.UUID) (entities.StoreMember, error) {
	dbStoreMember, err := r.queries.GetStoreMemberByAccountIDAndStoreID(c, sqlc.GetStoreMemberByAccountIDAndStoreIDParams{
		AccountID: accountID,
		StoreID:   storeID,
	})

	return toStoreMember(dbStoreMember), err
}

func (r *StoreMemberRepository) GetStoreMembersByStoreID(c context.Context, storeID uuid.UUID) ([]entities.StoreMember, error) {
	dbStoreMembers, err := r.queries.GetStoreMembersByStoreID(c, storeID)
	if err != nil {
		return nil, err
	}

	return utils.Map(dbStoreMembers, func(m sqlc.GetStoreMembersByStoreIDRow) entities.StoreMember {
		return entities.StoreMember{
			StoreID:     m.StoreID,
			AccountID:   m.AccountID,
			Role:        entities.StoreMemberRole(m.Role),
			JoinedAt:    m.JoinedAt.Time,
			DisplayName: m.DisplayName,
			PictureURL:  m.PictureUrl,
		}
	}), nil
}

func (r *StoreMemberRepository) RemoveStoreMemberByAccountIDAndStoreID(c context.Context, accountID uuid.UUID, storeID uuid.UUID) error {
	return r.queries.RemoveStoreMemberByAccountIDAndStoreID(c, sqlc.RemoveStoreMemberByAccountIDAndStoreIDParams{
		AccountID: accountID,
		StoreID:   storeID,
	})
}

func toStoreMembership(dbStoreMember sqlc.StoreMember) entities.StoreMembership {
	return entities.StoreMembership{
		AccountID: dbStoreMember.AccountID,
		StoreID:   dbStoreMember.StoreID,
		Role:      entities.StoreMemberRole(dbStoreMember.Role),
		JoinedAt:  dbStoreMember.JoinedAt.Time,
	}
}

func toStoreMember(dbStoreMember sqlc.GetStoreMemberByAccountIDAndStoreIDRow) entities.StoreMember {
	return entities.StoreMember{
		StoreID:     dbStoreMember.StoreID,
		AccountID:   dbStoreMember.AccountID,
		Role:        entities.StoreMemberRole(dbStoreMember.Role),
		JoinedAt:    dbStoreMember.JoinedAt.Time,
		DisplayName: dbStoreMember.DisplayName,
		PictureURL:  dbStoreMember.PictureUrl,
	}
}

var _ repositoryinterfaces.StoreMembersRepository = (*StoreMemberRepository)(nil)
