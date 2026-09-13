package carts

import (
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/services/store/carts"
	"github.com/jackc/pgx/v5/pgxpool"
)

type CartRepository struct {
	queries *sqlc.Queries
	pool    *pgxpool.Pool
}

func NewCartRepository(queries *sqlc.Queries, pool *pgxpool.Pool) *CartRepository {
	return &CartRepository{
		queries: queries,
		pool:    pool,
	}
}

var _ carts.CartRepository = (*CartRepository)(nil)
