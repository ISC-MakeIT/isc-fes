package menus

import (
	"context"
	"io"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/isc-makeit/isc-fes/backend/services"
)

// メニュー画像を処理して、S3にアップロードする
func (s *MenuService) processAndUploadMenuImage(c context.Context, menuID uuid.UUID, img io.ReadSeeker) (menus.MenuImageObjectKey, error) {
	imageObjectKey := menus.NewMenuImageObjectKey(menuID)

	processedImage, contentType, err := s.imageProcessor.ProcessForMenuImage(c, img)
	if err != nil {
		return menus.NewMenuImageObjectKey(uuid.UUID{}), err
	}

	err = s.imageRepository.PutObject(c, processedImage, entities.StoreImageObjectKey(imageObjectKey), contentType)
	if err != nil {
		return menus.NewMenuImageObjectKey(uuid.UUID{}), services.ErrFailedToStoreImage
	}

	return imageObjectKey, nil
}
