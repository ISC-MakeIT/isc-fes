package menus

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	domainactivity "github.com/isc-makeit/isc-fes/backend/domains/activity"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/isc-makeit/isc-fes/backend/repositories/activity"
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

	if _, err := qtx.LockStoreForUpdate(c, input.StoreID); err != nil {
		return menus.Menu{}, err
	}
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
	after, err := activity.MenuSnapshot(c, qtx, m)
	if err != nil {
		return menus.Menu{}, err
	}
	if err := activity.Record(c, qtx, domainactivity.Event{
		Type: domainactivity.MenuCreated, StoreID: m.StoreID, SubjectID: m.ID,
		Actor: domainactivity.AccountActor(input.AccountID), Payload: domainactivity.Payload{After: after},
	}); err != nil {
		return menus.Menu{}, err
	}

	if err := tx.Commit(c); err != nil {
		return menus.Menu{}, fmt.Errorf("failed to commit CreateMenuWithToppings transaction: %w", err)
	}

	return db2entities.ToMenu(m), err
}

func (r *MenuRepository) DeleteMenuByStoreIDAndMenuID(c context.Context, storeID, menuID, accountID uuid.UUID) (int64, error) {
	tx, err := r.pool.Begin(c)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(c)
	qtx := r.queries.WithTx(tx)
	if _, err := qtx.LockStoreForUpdate(c, storeID); err != nil {
		return 0, err
	}
	m, err := qtx.GetMenuByStoreIDAndMenuID(c, sqlc.GetMenuByStoreIDAndMenuIDParams{StoreID: storeID, ID: menuID})
	if err != nil {
		return 0, err
	}
	before, err := activity.MenuSnapshot(c, qtx, m)
	if err != nil {
		return 0, err
	}
	count, err := qtx.DeleteMenuByStoreIDAndMenuID(c, sqlc.DeleteMenuByStoreIDAndMenuIDParams{
		StoreID: storeID,
		ID:      menuID,
	})
	if err != nil {
		return 0, fmt.Errorf("failed to delete menu: %w", err)
	}
	if count > 0 {
		if err := activity.Record(c, qtx, domainactivity.Event{
			Type: domainactivity.MenuDeleted, StoreID: storeID, SubjectID: menuID,
			Actor: domainactivity.AccountActor(accountID), Payload: domainactivity.Payload{Before: before},
		}); err != nil {
			return 0, err
		}
	}

	if err := tx.Commit(c); err != nil {
		return 0, err
	}
	return count, nil
}

var _ menuService.MenuRepository = (*MenuRepository)(nil)
