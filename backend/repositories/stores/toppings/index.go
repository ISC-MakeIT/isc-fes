package toppings

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/toppings"
	"github.com/isc-makeit/isc-fes/backend/repositories"
	"github.com/isc-makeit/isc-fes/backend/repositories/db2entities"
	toppings_service "github.com/isc-makeit/isc-fes/backend/services/store/toppings"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type ToppingsRepository struct {
	queries *sqlc.Queries
	pool    *pgxpool.Pool
}

func NewToppingsRepository(queries *sqlc.Queries, pool *pgxpool.Pool) *ToppingsRepository {
	return &ToppingsRepository{
		queries: queries,
		pool:    pool,
	}
}

func (r *ToppingsRepository) GetToppingsByStoreID(c context.Context, storeID uuid.UUID) ([]toppings.Topping, error) {
	dbToppings, err := r.queries.GetToppingsByStoreID(c, storeID)
	return db2entities.ToToppings(dbToppings), err
}

func (r *ToppingsRepository) CreateTopping(c context.Context, storeID uuid.UUID, name string, unitPrice int32) (toppings.Topping, error) {
	dbTopping, err := r.queries.CreateTopping(c, sqlc.CreateToppingParams{
		StoreID:   storeID,
		Name:      name,
		UnitPrice: unitPrice,
	})
	return db2entities.ToTopping(dbTopping), err
}

func (r *ToppingsRepository) DeleteTopping(c context.Context, storeID, toppingID uuid.UUID) error {
	tx, qtx, err := repositories.SetupTransaction(c, r.pool, r.queries)
	if err != nil {
		return err
	}
	defer tx.Rollback(c)

	// menu_toppings テーブルの関連付けを削除する
	err = qtx.DeleteMenuToppingsByToppingID(c, toppingID)
	if err != nil {
		return err
	}

	rows, err := qtx.DeleteTopping(c, sqlc.DeleteToppingParams{
		StoreID: storeID,
		ID:      toppingID,
	})
	if err != nil {
		return err
	}
	if rows == 0 {
		return pgx.ErrNoRows
	}

	return tx.Commit(c)
}

func (r *ToppingsRepository) UpdateToppingByToppingIDAndStoreID(c context.Context, toppingID, storeID uuid.UUID, input toppings_service.UpdateToppingRepositoryInput) (toppings.Topping, error) {
	dbTopping, err := r.queries.UpdateToppingByToppingIDAndStoreID(c, sqlc.UpdateToppingByToppingIDAndStoreIDParams{
		ToppingID: toppingID,
		StoreID:   storeID,
		Name:      input.Name,
		UnitPrice: input.UnitPrice,
		SoldOut:   input.SoldOut,
	})
	return db2entities.ToTopping(dbTopping), err
}

var _ toppings_service.ToppingsRepository = (*ToppingsRepository)(nil)
