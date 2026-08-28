package menus

import (
	"context"
	"fmt"

	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/isc-makeit/isc-fes/backend/repositories"
	"github.com/isc-makeit/isc-fes/backend/repositories/db2entities"
	menu_service "github.com/isc-makeit/isc-fes/backend/services/store/menus"
)

func (r *MenuRepository) UpdateMenuWithToppings(c context.Context, input menu_service.UpdateMenuRepositoryInput) (menus.Menu, error) {
	tx, qtx, err := repositories.SetupTransaction(c, r.pool, r.queries)
	if err != nil {
		return menus.Menu{}, err
	}
	defer tx.Rollback(c)

	m, err := qtx.UpdateMenu(c, sqlc.UpdateMenuParams{
		ID:             input.ID,
		StoreID:        input.StoreID,
		Name:           input.Name,
		Description:    input.Description,
		UnitPrice:      input.UnitPrice,
		ImageObjectKey: (*string)(input.ImageObjectKey),
	})
	if err != nil {
		return menus.Menu{}, fmt.Errorf("failed to update menu: %w", err)
	}

	if input.ToppingIds != nil {
		toppingIDs := *input.ToppingIds
		// 空配列の場合でも、既存のトッピング関連付けを全て削除するために処理を続行する

		// 既存のトッピング関連付けを全て削除し、新しいトッピング関連付けを作成する
		// 既存のトッピング関連づけと新しいトッピング関連付けの差分を計算して、必要な追加・削除をすることもできるが、
		// その場合 SELECT が必要になり、また実装も複雑になるため、ここでは単純に全削除して新規作成する方法を採用する。
		// 関連付けの件数は少ないはずなので全削除・全追加のコストも小さい
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

	if err := tx.Commit(c); err != nil {
		return menus.Menu{}, fmt.Errorf("failed to commit UpdateMenuWithToppings transaction: %w", err)
	}

	return db2entities.ToMenu(m), nil
}
