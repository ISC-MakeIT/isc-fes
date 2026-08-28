package repositories

import (
	"context"
	"fmt"

	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

func SetupTransaction(c context.Context, p *pgxpool.Pool, q *sqlc.Queries) (pgx.Tx, *sqlc.Queries, error) {
	tx, err := p.Begin(c)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to begin transaction: %w", err)
	}

	qtx := q.WithTx(tx)

	return tx, qtx, nil
}
