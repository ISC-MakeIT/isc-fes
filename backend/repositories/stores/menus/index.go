package menus

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/isc-makeit/isc-fes/backend/repositories/db2entities"
	menuService "github.com/isc-makeit/isc-fes/backend/services/store/menus"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MenuRepository struct {
	queries *sqlc.Queries
	pool    *pgxpool.Pool
}

func NewMenuRepository(queries *sqlc.Queries, pool *pgxpool.Pool) *MenuRepository {
	return &MenuRepository{
		queries: queries,
		pool:    pool,
	}
}

func (r *MenuRepository) GetMenusByStoreID(c context.Context, storeID uuid.UUID) ([]menus.Menu, error) {
	dbMenus, err := r.queries.GetMenusByStoreID(c, storeID)

	return db2entities.ToMenus(dbMenus), err
}

func (r *MenuRepository) CreateMenuWithToppings(c context.Context, input menuService.CreateMenuRepositoryInput) (menus.Menu, error) {
	tx, err := r.pool.Begin(c)
	if err != nil {
		return menus.Menu{}, err
	}
	defer tx.Rollback(c)

	qtx := r.queries.WithTx(tx)
	m, err := qtx.CreateMenu(c, sqlc.CreateMenuParams{
		ID:             input.ID,
		StoreID:        input.StoreID,
		Name:           input.Name,
		Description:    input.Description,
		UnitPrice:      input.UnitPrice,
		ImageObjectKey: input.ImageObjectKey.String(),
	})
	if err != nil {
		return menus.Menu{}, fmt.Errorf("failed to create menu: %w", err)
	}

	// トッピングの関連付けを作成する
	err = qtx.CreateMenuToppings(c, sqlc.CreateMenuToppingsParams{
		StoreID:    m.StoreID,
		MenuID:     m.ID,
		ToppingIds: input.ToppingIds,
	})
	if err != nil {
		return menus.Menu{}, fmt.Errorf("failed to create menu toppings: %w", err)
	}

	if err := tx.Commit(c); err != nil {
		return menus.Menu{}, fmt.Errorf("failed to commit CreateMenuWithToppings transaction: %w", err)
	}

	return db2entities.ToMenu(m), err
}

var _ menuService.MenuRepository = (*MenuRepository)(nil)
