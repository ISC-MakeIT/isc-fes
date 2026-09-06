package services

import (
	"context"
	"errors"
	"fmt"
	"io"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

// ImageProcessorは、利用者がアップロードした画像を配信可能な形式へ変換する。
type ImageProcessor interface {
	ProcessForStoreImage(ctx context.Context, reader io.ReadSeeker) (io.ReadSeeker, string, error)
}

type ImageRepository interface {
	PutObject(ctx context.Context, reader io.ReadSeeker, objectKey entities.ImageObjectKey, contentType string) error

	DeleteObject(ctx context.Context, objectKey entities.ImageObjectKey) error
}

type ImageService struct {
	imageProcessor  ImageProcessor
	imageRepository ImageRepository
}

func NewImageService(
	imageProcessor ImageProcessor,
	imageRepository ImageRepository,
) *ImageService {
	return &ImageService{
		imageProcessor:  imageProcessor,
		imageRepository: imageRepository,
	}
}

var (
	// ErrEmptyImageは、入力された画像が空であることを示す。
	ErrEmptyImage = errors.New("empty image")
	// ErrImageTooLargeは、入力画像のファイルサイズが上限を超えていることを示す。
	ErrImageTooLarge = errors.New("image too large")
	// ErrUnsupportedImageFormatは、入力画像が対応していない形式であることを示す。
	ErrUnsupportedImageFormat = errors.New("unsupported image format")
	// ErrInvalidImageは、入力画像が破損しているか、画像として解釈できないことを示す。
	ErrInvalidImage = errors.New("invalid image")
	// ErrImageDimensionsExceededは、入力画像の幅、高さ、または総画素数が上限を超えていることを示す。
	ErrImageDimensionsExceeded = errors.New("image dimensions exceeded")
	// ErrProcessedImageTooLargeは、変換後の画像サイズが上限を超えていることを示す。
	ErrProcessedImageTooLarge = errors.New("processed image too large")
)

func (s *ImageService) UploadImage(
	ctx context.Context,
	imageReader io.ReadSeeker,
) (entities.ImageObjectKey, error) {
	if _, err := RequireAuthenticatedAccount(ctx); err != nil {
		return "", err
	}

	imageID, err := uuid.NewRandom()
	if err != nil {
		return "", fmt.Errorf("generate image UUID: %w", err)
	}
	objectKey := entities.NewImageObjectKey(imageID)

	processedImage, contentType, err := s.imageProcessor.ProcessForStoreImage(ctx, imageReader)
	if err != nil {
		return "", fmt.Errorf("process image: %w", err)
	}

	if err := s.imageRepository.PutObject(ctx, processedImage, objectKey, contentType); err != nil {
		return "", fmt.Errorf("%w: %w", ErrFailedToStoreImage, err)
	}

	return objectKey, nil
}
