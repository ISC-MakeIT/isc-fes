package carts

import (
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/services/store/carts"
)

type CartRepository struct {
	queries *sqlc.Queries
}

func NewCartRepository(queries *sqlc.Queries) *CartRepository {
	return &CartRepository{
		queries: queries,
	}
}

var _ carts.CartRepository = (*CartRepository)(nil)
