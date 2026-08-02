package service_interface

import (
	"context"

	"github.com/google/uuid"

	"github.com/isc-makeit/isc-fes/backend/internal/domain/entities"
)

type AccountRepository interface {
	GetAccountByID(ctx context.Context, accountID uuid.UUID) (entities.Account, error)
}
