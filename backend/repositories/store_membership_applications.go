package repositories

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/isc-makeit/isc-fes/backend/utils"
	"github.com/jackc/pgx/v5/pgtype"
)

type StoreMembershipApplicationsRepository struct {
	queries *sqlc.Queries
}

func NewStoreMembershipApplicationsRepository(queries *sqlc.Queries) *StoreMembershipApplicationsRepository {
	return &StoreMembershipApplicationsRepository{
		queries: queries,
	}
}

func (r *StoreMembershipApplicationsRepository) GetStoreMembershipApplicationsByStoreID(ctx context.Context, storeID uuid.UUID) ([]entities.StoreMembershipApplication, error) {
	dbStoreMembershipApplications, err := r.queries.GetStoreMembershipApplicationsByStoreID(ctx, storeID)
	if err != nil {
		return nil, err
	}

	return utils.Map(dbStoreMembershipApplications, toStoreMembershipApplication), nil
}

func (r *StoreMembershipApplicationsRepository) GetStoreMembershipApplicationsByAccountID(ctx context.Context, accountID uuid.UUID) ([]entities.StoreMembershipApplication, error) {
	dbStoreMembershipApplications, err := r.queries.GetStoreMembershipApplicationsByAccountID(ctx, accountID)
	if err != nil {
		return nil, err
	}

	return utils.Map(dbStoreMembershipApplications, toStoreMembershipApplication), nil
}

func toStoreMembershipApplication(dbStoreMembershipApplication sqlc.StoreMembershipApplication) entities.StoreMembershipApplication {
	return entities.StoreMembershipApplication{
		ID:              dbStoreMembershipApplication.ID,
		StoreID:         dbStoreMembershipApplication.StoreID,
		AccountID:       dbStoreMembershipApplication.AccountID,
		Status:          entities.StoreMembershipApplicationStatus(dbStoreMembershipApplication.Status),
		ReviewedBy:      dbStoreMembershipApplication.ReviewedBy,
		ReviewedAt:      timestamptzPtr(dbStoreMembershipApplication.ReviewedAt),
		RejectionReason: dbStoreMembershipApplication.RejectionReason,
		SubmittedAt:     dbStoreMembershipApplication.SubmittedAt.Time,
	}
}

func timestamptzPtr(value pgtype.Timestamptz) *time.Time {
	if !value.Valid {
		return nil
	}

	t := value.Time
	return &t
}

var _ services.StoreMembershipApplicationsRepository = (*StoreMembershipApplicationsRepository)(nil)
