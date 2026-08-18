package menus

import (
	"context"
	"errors"
	"io"

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

type CreateMenuInput struct {
	Name        string
	Description string
	UnitPrice   int32
	ImageReader io.ReadSeeker
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

	member, err := s.storeMemberRepository.GetStoreMemberByAccountIDAndStoreID(c, account.ID, store.ID)
	if errors.Is(err, pgx.ErrNoRows) {
		return menus.MenuDisplay{}, services.ErrForbidden
	}
	if err != nil {
		return menus.MenuDisplay{}, err
	}
	if !member.IsMenuManagementAllowed() {
		return menus.MenuDisplay{}, services.ErrForbidden
	}

	// メニュー画像を処理して、S3にアップロードする
	menuID, err := uuid.NewRandom()
	if err != nil {
		return menus.MenuDisplay{}, err
	}
	imageObjectKey := menus.NewMenuImageObjectKey(menuID)

	processedImage, contentType, err := s.imageProcessor.ProcessForMenuImage(c, input.ImageReader)
	if err != nil {
		return menus.MenuDisplay{}, err
	}

	err = s.imageRepository.PutObject(c, processedImage, entities.StoreImageObjectKey(imageObjectKey), contentType)
	if err != nil {
		return menus.MenuDisplay{}, services.ErrFailedToStoreImage
	}

	imageURL, err := s.imageURLGenerator.GenerateMenuImageURL(c, imageObjectKey)
	if err != nil {
		s.imageRepository.DeleteObject(c, entities.StoreImageObjectKey(imageObjectKey))
		return menus.MenuDisplay{}, err
	}

	menu, err := s.menuRepository.CreateMenu(c, CreateMenuRepositoryInput{
		ID:             menuID,
		StoreID:        storeID,
		Name:           input.Name,
		Description:    input.Description,
		UnitPrice:      input.UnitPrice,
		ImageObjectKey: imageObjectKey,
	})
	if err != nil {
		s.imageRepository.DeleteObject(c, entities.StoreImageObjectKey(imageObjectKey))
		return menus.MenuDisplay{}, err
	}

	return entity2display.ToMenuDisplayWithImageURL(menu, imageURL), nil
}
