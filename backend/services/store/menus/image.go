package menus

import (
	"context"
	"io"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/isc-makeit/isc-fes/backend/services"
)

// メニュー画像を処理して、S3にアップロードする
func (s *MenuService) processAndUploadMenuImage(c context.Context, img io.ReadSeeker) (menus.MenuImageObjectKey, error) {
	imageID, err := uuid.NewRandom()
	if err != nil {
		return "", err
	}
	imageObjectKey := menus.NewMenuImageObjectKey(imageID)

	processedImage, contentType, err := s.imageProcessor.ProcessForMenuImage(c, img)
	if err != nil {
		return "", err
	}

	err = s.imageRepository.PutObject(c, processedImage, imageObjectKey, contentType)
	if err != nil {
		return "", services.ErrFailedToStoreImage
	}

	return imageObjectKey, nil
}
