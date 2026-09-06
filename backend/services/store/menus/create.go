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

type CreateMenuInput struct {
	Name           string
	Description    string
	UnitPrice      int32
	ToppingIds     []uuid.UUID
	ImageObjectKey menus.MenuImageObjectKey
}

func (s *MenuService) CreateMenu(c context.Context, storeID uuid.UUID, input CreateMenuInput) (menus.MenuDisplay, error) {
	account, err := services.RequireAuthenticatedAccount(c)
	if err != nil {
		return menus.MenuDisplay{}, err
	}

	// 認可

	store, err := s.storeRepository.GetStoreByID(c, storeID)
	// 未承認の店舗はメニューを登録できない
	if errors.Is(err, pgx.ErrNoRows) {
		return menus.MenuDisplay{}, services.ErrNotFound
	}
	if err != nil {
		return menus.MenuDisplay{}, err
	}
	if !store.IsVisibleInPublic() {
		return menus.MenuDisplay{}, services.ErrNotFound
	}

	member, err := s.storeMemberRepository.GetStoreMembershipByAccountIDAndStoreID(c, account.ID, store.ID)
	if errors.Is(err, pgx.ErrNoRows) {
		return menus.MenuDisplay{}, services.ErrForbidden
	}
	if err != nil {
		return menus.MenuDisplay{}, err
	}
	if !member.IsMenuManagementAllowed() {
		return menus.MenuDisplay{}, services.ErrForbidden
	}

	if !input.ImageObjectKey.IsValid() {
		return menus.MenuDisplay{}, services.ErrInvalidInput
	}

	menuID, err := uuid.NewRandom()
	if err != nil {
		return menus.MenuDisplay{}, err
	}
	imageURL, err := s.imageURLGenerator.GenerateMenuImageURL(c, input.ImageObjectKey)
	if err != nil {
		return menus.MenuDisplay{}, err
	}

	menu, err := s.menuRepository.CreateMenuWithToppings(c, CreateMenuRepositoryInput{
		ID:             menuID,
		StoreID:        storeID,
		Name:           input.Name,
		Description:    input.Description,
		UnitPrice:      input.UnitPrice,
		ImageObjectKey: input.ImageObjectKey,
		ToppingIds:     input.ToppingIds,
	})
	if err != nil {
		return menus.MenuDisplay{}, err
	}

	return entity2display.ToMenuDisplayWithImageURL(menu, imageURL), nil
}
