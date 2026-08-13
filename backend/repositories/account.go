package repositories

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/services"
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

	return ToAccount(dbAccount), nil
}

func (r *AccountRepository) UpsertGoogleAccount(ctx context.Context, identity services.GoogleIdentity) (entities.Account, error) {
	var pictureURL *string

	if identity.PictureURL != "" {
		pictureURL = &identity.PictureURL
	}

	acc, err := r.queries.UpsertAccount(ctx, sqlc.UpsertAccountParams{
		GoogleSub:   identity.Subject,
		Email:       identity.Email,
		DisplayName: identity.DisplayName,
		PictureUrl:  pictureURL,
	})

	return ToAccount(acc), err
}

// ToAccount converts a sqlc.Account to an Account entity.
func ToAccount(dbAccount sqlc.Account) entities.Account {
	return entities.Account{
		ID:          dbAccount.ID,
		GoogleSub:   dbAccount.GoogleSub,
		Email:       dbAccount.Email,
		DisplayName: dbAccount.DisplayName,
		PictureURL:  dbAccount.PictureUrl,
		Role:        entities.Role(dbAccount.Role),
		LastLoginAt: dbAccount.LastLoginAt.Time,
		CreatedAt:   dbAccount.CreatedAt.Time,
		UpdatedAt:   dbAccount.UpdatedAt.Time,
	}
}

var _ services.AccountRepository = (*AccountRepository)(nil)
