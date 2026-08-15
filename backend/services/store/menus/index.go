package menus

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/isc-makeit/isc-fes/backend/services/entity2display"
	"github.com/jackc/pgx/v5"
)

type MenuService struct {
	menuRepository    MenuRepository
	imageURLGenerator services.ImageURLGenerator
	storeRepository   services.StoreRepository
}

func NewMenuService(menuRepository MenuRepository, imageURLGenerator services.ImageURLGenerator, storeRepository services.StoreRepository) *MenuService {
	return &MenuService{
		menuRepository:    menuRepository,
		imageURLGenerator: imageURLGenerator,
		storeRepository:   storeRepository,
	}
}

func (s *MenuService) GetMenusByStoreID(c context.Context, storeID uuid.UUID) ([]menus.MenuDisplay, error) {
	store, err := s.storeRepository.GetStoreByID(c, storeID)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, services.ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	if store.ReviewStatus != entities.StoreReviewStatusApproved {
		return nil, services.ErrNotFound
	}

	entityMenus, err := s.menuRepository.GetMenusByStoreID(c, storeID)
	if err != nil {
		return nil, err
	}

	return entity2display.ToMenuDisplays(c, entityMenus, s.imageURLGenerator)
}
