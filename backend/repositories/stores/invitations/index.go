package invitations

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	repositoryinterfaces "github.com/isc-makeit/isc-fes/backend/services/repository_interfaces"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type StoreInvitationRepository struct {
	queries *sqlc.Queries
	pool    *pgxpool.Pool
}

func NewStoreInvitationRepository(queries *sqlc.Queries, pool *pgxpool.Pool) *StoreInvitationRepository {
	return &StoreInvitationRepository{
		queries: queries,
		pool:    pool,
	}
}

func (r *StoreInvitationRepository) GetStoreInvitationByID(ctx context.Context, invitationID uuid.UUID) (entities.StoreInvitation, error) {
	inv, err := r.queries.GetStoreInvitationByID(ctx, invitationID)
	return toStoreInvitation(inv), err
}

func (r *StoreInvitationRepository) CreateStoreInvitation(ctx context.Context, storeID uuid.UUID, Role entities.StoreMemberRole, MaxUses *int32) (entities.StoreInvitation, error) {
	inv, err := r.queries.CreateStoreInvitation(ctx, sqlc.CreateStoreInvitationParams{
		StoreID: storeID,
		Role:    sqlc.StoreMemberRole(Role),
		MaxUses: MaxUses,
	})
	return toStoreInvitation(inv), err
}

func (r *StoreInvitationRepository) AcceptStoreInvitation(ctx context.Context, invitationID uuid.UUID, accountID uuid.UUID) (entities.StoreInvitation, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return entities.StoreInvitation{}, err
	}
	defer tx.Rollback(ctx)

	qtx := r.queries.WithTx(tx)

	inv, err := qtx.IncrementStoreInvitationUseCount(ctx, invitationID)
	if err != nil {
		return entities.StoreInvitation{}, err
	}

	_, err = qtx.CreateStoreMemberIfNotExists(ctx, sqlc.CreateStoreMemberIfNotExistsParams{
		StoreID:   inv.StoreID,
		AccountID: accountID,
		Role:      inv.Role,
	})
	if errors.Is(err, pgx.ErrNoRows) {
		return entities.StoreInvitation{}, repositoryinterfaces.ErrStoreMemberAlreadyExists
	}
	if err != nil {
		return entities.StoreInvitation{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return entities.StoreInvitation{}, err
	}

	return toStoreInvitation(inv), nil
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
