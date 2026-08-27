package menus

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/isc-makeit/isc-fes/backend/services/entity2display"
	repositoryinterfaces "github.com/isc-makeit/isc-fes/backend/services/repository_interfaces"
	"github.com/jackc/pgx/v5"
)

type MenuService struct {
	menuRepository        MenuRepository
	imageURLGenerator     services.ImageURLGenerator
	storeRepository       services.StoreRepository
	storeMemberRepository repositoryinterfaces.StoreMembersRepository
	imageProcessor        ImageProcessor
	imageRepository       services.ImageRepository
}

func NewMenuService(menuRepository MenuRepository, imageURLGenerator services.ImageURLGenerator, storeRepository services.StoreRepository, storeMemberRepository repositoryinterfaces.StoreMembersRepository, imageProcessor ImageProcessor, imageRepository services.ImageRepository) *MenuService {
	return &MenuService{
		menuRepository:        menuRepository,
		imageURLGenerator:     imageURLGenerator,
		storeRepository:       storeRepository,
		storeMemberRepository: storeMemberRepository,
		imageProcessor:        imageProcessor,
		imageRepository:       imageRepository,
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
