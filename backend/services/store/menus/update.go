package menus

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/isc-makeit/isc-fes/backend/services/entity2display"
	"github.com/jackc/pgx/v5"
)

// CreateMenuInput と構造的には同じだが、Optional にするために別の構造体として定義
type UpdateMenuInput struct {
	Name           *string
	Description    *string
	UnitPrice      *int32
	ToppingIds     []uuid.UUID
	ImageObjectKey *menus.MenuImageObjectKey
}

func (s *MenuService) UpdateMenuByStoreIDAndMenuID(c context.Context, storeID uuid.UUID, menuID uuid.UUID, input UpdateMenuInput) (menus.MenuDisplay, error) {
	account, err := services.RequireAuthenticatedAccount(c)
	if err != nil {
		return menus.MenuDisplay{}, err
	}
	if input.ImageObjectKey != nil && !input.ImageObjectKey.IsValid() {
		return menus.MenuDisplay{}, services.ErrInvalidInput
	}

	// 認可
	_, err = s.storeRepository.GetApprovedStoreByID(c, storeID)
	// 未承認 || そもそも店舗が存在しない場合は 404
	if errors.Is(err, pgx.ErrNoRows) {
		return menus.MenuDisplay{}, services.ErrNotFound
	}
	if err != nil {
		return menus.MenuDisplay{}, err
	}

	storeMembership, err := s.storeMemberRepository.GetStoreMembershipByAccountIDAndStoreID(c, account.ID, storeID)
	if errors.Is(err, pgx.ErrNoRows) {
		return menus.MenuDisplay{}, services.ErrForbidden
	}
	if err != nil {
		return menus.MenuDisplay{}, err
	}
	if !storeMembership.IsMenuManagementAllowed() {
		return menus.MenuDisplay{}, services.ErrForbidden
	}

	// メニューが存在するか確認
	menu, err := s.menuRepository.GetMenuByStoreIDAndMenuID(c, storeID, menuID)
	if errors.Is(err, pgx.ErrNoRows) {
		return menus.MenuDisplay{}, services.ErrNotFound
	}
	if err != nil {
		return menus.MenuDisplay{}, err
	}

	//全て nil の場合は更新せずにそのまま返す
	// これがなくても大きな問題にはならないが、update クエリ1つ分の節約になる
	if input.IsAllNil() {
		return entity2display.ToMenuDisplay(c, menu, s.imageURLGenerator)
	}

	// メニューを更新する
	var toppingIDs *[]uuid.UUID
	if input.ToppingIds != nil {
		toppingIDs = &input.ToppingIds
	}
	updatedMenu, err := s.menuRepository.UpdateMenuWithToppings(c, UpdateMenuRepositoryInput{
		ID:             menu.ID,
		StoreID:        menu.StoreID,
		Name:           input.Name,
		Description:    input.Description,
		UnitPrice:      input.UnitPrice,
		ToppingIds:     toppingIDs,
		ImageObjectKey: input.ImageObjectKey,
	})
	if err != nil {
		return menus.MenuDisplay{}, err
	}
	if input.ImageObjectKey != nil && *input.ImageObjectKey != menu.ImageObjectKey {
		s.imageRepository.DeleteObject(c, menu.ImageObjectKey)
	}

	return entity2display.ToMenuDisplay(c, updatedMenu, s.imageURLGenerator)
}

func (i *UpdateMenuInput) IsAllNil() bool {
	return i.Name == nil && i.Description == nil && i.UnitPrice == nil && i.ToppingIds == nil && i.ImageObjectKey == nil
}
