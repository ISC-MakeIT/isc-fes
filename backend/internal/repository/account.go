package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/internal/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/internal/domain/entities"
)

type AccountRepository struct {
	queries *sqlc.Queries
}

func NewAccountRepository(queries *sqlc.Queries) *AccountRepository {
	return &AccountRepository{
		queries: queries,
	}
}

func (r *AccountRepository) GetAccountByID(ctx context.Context, accountID uuid.UUID) (entities.Account, error) {
	dbAccount, err := r.queries.GetAccountByID(ctx, accountID)
	if err != nil {
		return entities.Account{}, err
	}

	return entities.Account{}.New(dbAccount), nil
}
