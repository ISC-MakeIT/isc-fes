package repository

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/internal/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/internal/domain/entities"
	"github.com/isc-makeit/isc-fes/backend/internal/service"
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

	storeMembershipApplications := make([]entities.StoreMembershipApplication, len(dbStoreMembershipApplications))
	for i, dbStoreMembershipApplication := range dbStoreMembershipApplications {
		storeMembershipApplications[i] = toStoreMembershipApplication(dbStoreMembershipApplication)
	}
	return storeMembershipApplications, nil
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

var _ service.StoreMembershipApplicationsRepository = (*StoreMembershipApplicationsRepository)(nil)
