package menus

import (
	"context"
	"fmt"

	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	domainactivity "github.com/isc-makeit/isc-fes/backend/domains/activity"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/isc-makeit/isc-fes/backend/repositories"
	"github.com/isc-makeit/isc-fes/backend/repositories/activity"
	"github.com/isc-makeit/isc-fes/backend/repositories/db2entities"
	menu_service "github.com/isc-makeit/isc-fes/backend/services/store/menus"
)

func (r *MenuRepository) UpdateMenuWithToppings(c context.Context, input menu_service.UpdateMenuRepositoryInput) (menus.Menu, error) {
	tx, qtx, err := repositories.SetupTransaction(c, r.pool, r.queries)
	if err != nil {
		return menus.Menu{}, err
	}
	defer tx.Rollback(c)

	if _, err := qtx.LockStoreForUpdate(c, input.StoreID); err != nil {
		return menus.Menu{}, err
	}
	current, err := qtx.GetMenuByStoreIDAndMenuID(c, sqlc.GetMenuByStoreIDAndMenuIDParams{ID: input.ID, StoreID: input.StoreID})
	if err != nil {
		return menus.Menu{}, err
	}
	before, err := activity.MenuSnapshot(c, qtx, current)
	if err != nil {
		return menus.Menu{}, err
	}

	m, err := qtx.UpdateMenu(c, sqlc.UpdateMenuParams{
		ID:             input.ID,
		StoreID:        input.StoreID,
		Name:           input.Name,
		Description:    input.Description,
		UnitPrice:      input.UnitPrice,
		SoldOut:        input.SoldOut,
		ImageObjectKey: (*string)(input.ImageObjectKey),
	})
	if err != nil {
		return menus.Menu{}, fmt.Errorf("failed to update menu: %w", err)
	}

	if input.ToppingIds != nil {
		toppingIDs := *input.ToppingIds
		// 空配列の場合でも、既存のトッピング関連付けを全て削除するために処理を続行する

		// 関連の全置換後に実際の集合を比較し、順序だけの違いは履歴に残さない。
		err = qtx.DeleteAllMenuToppingsByMenuID(c, input.ID)
		if err != nil {
			return menus.Menu{}, fmt.Errorf("failed to delete menu toppings: %w", err)
		}

		err = qtx.CreateMenuToppings(c, sqlc.CreateMenuToppingsParams{
			StoreID:    input.StoreID,
			MenuID:     input.ID,
			ToppingIds: toppingIDs,
		})
		if err != nil {
			return menus.Menu{}, fmt.Errorf("failed to create menu toppings: %w", err)
		}
	}
	after, err := activity.MenuSnapshot(c, qtx, m)
	if err != nil {
		return menus.Menu{}, err
	}
	if payload, changed := domainactivity.Diff(before, after); changed {
		if err := activity.Record(c, qtx, domainactivity.Event{
			Type: domainactivity.MenuUpdated, StoreID: m.StoreID, SubjectID: m.ID,
			Actor: domainactivity.AccountActor(input.AccountID), Payload: payload,
		}); err != nil {
			return menus.Menu{}, err
		}
	}

	if err := tx.Commit(c); err != nil {
		return menus.Menu{}, fmt.Errorf("failed to commit UpdateMenuWithToppings transaction: %w", err)
	}

	return db2entities.ToMenu(m), nil
}
