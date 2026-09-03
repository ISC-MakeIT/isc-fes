package repositories

import (
	"context"

	"github.com/google/uuid"
	db "github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/services"
)

type GuestRepository struct {
	queries *db.Queries
}

func NewGuestRepository(queries *db.Queries) *GuestRepository {
	return &GuestRepository{queries: queries}
}

func (r *GuestRepository) CreateGuest(ctx context.Context) (uuid.UUID, error) {
	return r.queries.CreateGuest(ctx)
}

var _ services.GuestRepository = (*GuestRepository)(nil)
