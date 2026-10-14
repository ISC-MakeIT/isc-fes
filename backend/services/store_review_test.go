package services

import (
	"context"
	"errors"
	"fmt"
	"testing"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/jackc/pgx/v5"
)

type reviewStoreRepositoryStub struct {
	StoreRepository
	store       entities.Store
	updateErr   error
	updateCalls int
}

func (r *reviewStoreRepositoryStub) GetStoreByID(context.Context, uuid.UUID) (entities.Store, error) {
	return r.store, nil
}

func (r *reviewStoreRepositoryStub) UpdateStoreReviewStatus(context.Context, uuid.UUID, entities.StoreReviewStatus, uuid.UUID) error {
	r.updateCalls++
	return r.updateErr
}

func TestUpdateStoreApplicationReviewStatusMapsUpdateErrors(t *testing.T) {
	databaseErr := errors.New("database unavailable")
	tests := []struct {
		name      string
		updateErr error
		wantErr   error
	}{
		{name: "store disappears before lock", updateErr: pgx.ErrNoRows, wantErr: ErrNotFound},
		{name: "wrapped missing store", updateErr: fmt.Errorf("lock store: %w", pgx.ErrNoRows), wantErr: ErrNotFound},
		{name: "other database error", updateErr: databaseErr, wantErr: databaseErr},
		{name: "success"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			storeID := uuid.New()
			repository := &reviewStoreRepositoryStub{
				store:     entities.Store{ID: storeID, ReviewStatus: entities.StoreReviewStatusPending},
				updateErr: test.updateErr,
			}
			service := &StoreService{storeRepository: repository}
			ctx := WithAuthenticatedAccount(t.Context(), entities.Account{ID: uuid.New(), Role: entities.RoleAdmin})

			err := service.UpdateStoreApplicationReviewStatus(ctx, storeID, entities.StoreReviewStatusApproved)
			if !errors.Is(err, test.wantErr) {
				t.Fatalf("error = %v, want %v", err, test.wantErr)
			}
			if repository.updateCalls != 1 {
				t.Fatalf("update calls = %d, want 1", repository.updateCalls)
			}
		})
	}
}
