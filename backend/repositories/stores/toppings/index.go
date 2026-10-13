package toppings

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	domainactivity "github.com/isc-makeit/isc-fes/backend/domains/activity"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/toppings"
	"github.com/isc-makeit/isc-fes/backend/repositories"
	"github.com/isc-makeit/isc-fes/backend/repositories/activity"
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

func (r *ToppingsRepository) GetToppingByToppingIDAndStoreID(c context.Context, toppingID, storeID uuid.UUID) (toppings.Topping, error) {
	dbTopping, err := r.queries.GetToppingByToppingIDAndStoreID(c, sqlc.GetToppingByToppingIDAndStoreIDParams{
		ID:      toppingID,
		StoreID: storeID,
	})
	return db2entities.ToTopping(dbTopping), err
}

func (r *ToppingsRepository) CreateTopping(c context.Context, storeID uuid.UUID, name string, unitPrice int32, accountID uuid.UUID) (toppings.Topping, error) {
	tx, qtx, err := repositories.SetupTransaction(c, r.pool, r.queries)
	if err != nil {
		return toppings.Topping{}, err
	}
	defer tx.Rollback(c)
	if _, err := qtx.LockStoreForUpdate(c, storeID); err != nil {
		return toppings.Topping{}, err
	}
	dbTopping, err := qtx.CreateTopping(c, sqlc.CreateToppingParams{
		StoreID:   storeID,
		Name:      name,
		UnitPrice: unitPrice,
	})
	if err != nil {
		return toppings.Topping{}, err
	}
	if err := activity.Record(c, qtx, domainactivity.Event{
		Type: domainactivity.ToppingCreated, StoreID: storeID, SubjectID: dbTopping.ID,
		Actor: domainactivity.AccountActor(accountID), Payload: domainactivity.Payload{After: activity.ToppingSnapshot(dbTopping)},
	}); err != nil {
		return toppings.Topping{}, err
	}
	if err := tx.Commit(c); err != nil {
		return toppings.Topping{}, err
	}
	return db2entities.ToTopping(dbTopping), nil
}

func (r *ToppingsRepository) DeleteTopping(c context.Context, storeID, toppingID, accountID uuid.UUID) error {
	tx, qtx, err := repositories.SetupTransaction(c, r.pool, r.queries)
	if err != nil {
		return err
	}
	defer tx.Rollback(c)

	if _, err := qtx.LockStoreForUpdate(c, storeID); err != nil {
		return err
	}
	current, err := qtx.GetToppingByToppingIDAndStoreID(c, sqlc.GetToppingByToppingIDAndStoreIDParams{StoreID: storeID, ID: toppingID})
	if err != nil {
		return err
	}
	menus, err := qtx.GetActivityMenusByTopping(c, sqlc.GetActivityMenusByToppingParams{StoreID: storeID, ToppingID: toppingID})
	if err != nil {
		return err
	}
	beforeMenus := make([]domainactivity.Snapshot, len(menus))
	affectedIDs := make([]uuid.UUID, len(menus))
	for i, menu := range menus {
		beforeMenus[i], err = activity.MenuSnapshot(c, qtx, menu)
		if err != nil {
			return err
		}
		affectedIDs[i] = menu.ID
	}

	// menu_toppings テーブルの関連付けを削除する
	err = qtx.DeleteMenuToppingsByToppingID(c, sqlc.DeleteMenuToppingsByToppingIDParams{ToppingID: toppingID, StoreID: storeID})
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
	if err := activity.Record(c, qtx, domainactivity.Event{
		Type: domainactivity.ToppingDeleted, StoreID: storeID, SubjectID: toppingID,
		Actor: domainactivity.AccountActor(accountID), Payload: domainactivity.Payload{
			Before:  activity.ToppingSnapshot(current),
			Context: map[string]any{"affected_menu_ids": domainactivity.UUIDSet(affectedIDs)},
		},
	}); err != nil {
		return err
	}
	for i, menu := range menus {
		after, err := activity.MenuSnapshot(c, qtx, menu)
		if err != nil {
			return err
		}
		payload, changed := domainactivity.Diff(beforeMenus[i], after)
		if !changed {
			continue
		}
		payload.Context = map[string]any{"cause": string(domainactivity.ToppingDeleted), "topping_id": toppingID}
		if err := activity.Record(c, qtx, domainactivity.Event{
			Type: domainactivity.MenuUpdated, StoreID: storeID, SubjectID: menu.ID,
			Actor: domainactivity.AccountActor(accountID), Payload: payload,
		}); err != nil {
			return err
		}
	}

	return tx.Commit(c)
}

func (r *ToppingsRepository) UpdateToppingByToppingIDAndStoreID(c context.Context, toppingID, storeID uuid.UUID, input toppings_service.UpdateToppingRepositoryInput) (toppings.Topping, error) {
	tx, qtx, err := repositories.SetupTransaction(c, r.pool, r.queries)
	if err != nil {
		return toppings.Topping{}, err
	}
	defer tx.Rollback(c)
	if _, err := qtx.LockStoreForUpdate(c, storeID); err != nil {
		return toppings.Topping{}, err
	}
	current, err := qtx.GetToppingByToppingIDAndStoreID(c, sqlc.GetToppingByToppingIDAndStoreIDParams{StoreID: storeID, ID: toppingID})
	if err != nil {
		return toppings.Topping{}, err
	}
	dbTopping, err := qtx.UpdateToppingByToppingIDAndStoreID(c, sqlc.UpdateToppingByToppingIDAndStoreIDParams{
		ToppingID: toppingID,
		StoreID:   storeID,
		Name:      input.Name,
		UnitPrice: input.UnitPrice,
		SoldOut:   input.SoldOut,
	})
	if err != nil {
		return toppings.Topping{}, err
	}
	if payload, changed := domainactivity.Diff(activity.ToppingSnapshot(current), activity.ToppingSnapshot(dbTopping)); changed {
		if err := activity.Record(c, qtx, domainactivity.Event{
			Type: domainactivity.ToppingUpdated, StoreID: storeID, SubjectID: toppingID,
			Actor: domainactivity.AccountActor(input.AccountID), Payload: payload,
		}); err != nil {
			return toppings.Topping{}, err
		}
	}
	if err := tx.Commit(c); err != nil {
		return toppings.Topping{}, err
	}
	return db2entities.ToTopping(dbTopping), nil
}

var _ toppings_service.ToppingsRepository = (*ToppingsRepository)(nil)
