package services

import (
	"bytes"
	"context"
	"errors"
	"io"
	"testing"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

type passthroughImageProcessor struct {
	err error
}

func (p passthroughImageProcessor) ProcessForStoreImage(
	_ context.Context,
	reader io.ReadSeeker,
) (io.ReadSeeker, string, error) {
	return reader, "image/jpeg", p.err
}

type recordingImageRepository struct {
	ImageRepository
	putKeys []entities.ImageObjectKey
	putErr  error
}

func (r *recordingImageRepository) PutObject(
	_ context.Context,
	_ io.ReadSeeker,
	key entities.ImageObjectKey,
	_ string,
) error {
	r.putKeys = append(r.putKeys, key)
	return r.putErr
}

func TestUploadImageStoresImageWithUniqueObjectKey(t *testing.T) {
	repository := &recordingImageRepository{}
	service := NewImageService(passthroughImageProcessor{}, repository)
	ctx := WithAuthenticatedAccount(t.Context(), entities.Account{ID: uuid.New()})

	objectKey, err := service.UploadImage(ctx, bytes.NewReader([]byte("image")))
	if err != nil {
		t.Fatalf("UploadImage() error = %v", err)
	}
	if !objectKey.IsValid() {
		t.Errorf("UploadImage() object key = %q, want valid key", objectKey)
	}
	if len(repository.putKeys) != 1 {
		t.Fatalf("PutObject() calls = %d, want 1", len(repository.putKeys))
	}
	if repository.putKeys[0] != objectKey {
		t.Errorf("PutObject() key = %q, want %q", repository.putKeys[0], objectKey)
	}
}

func TestUploadImageRequiresAuthenticatedAccount(t *testing.T) {
	repository := &recordingImageRepository{}
	service := NewImageService(passthroughImageProcessor{}, repository)

	_, err := service.UploadImage(t.Context(), bytes.NewReader([]byte("image")))
	if !errors.Is(err, ErrUnauthenticated) {
		t.Fatalf("UploadImage() error = %v, want ErrUnauthenticated", err)
	}
	if len(repository.putKeys) != 0 {
		t.Errorf("PutObject() calls = %d, want 0", len(repository.putKeys))
	}
}

func TestUploadImageMapsRepositoryFailure(t *testing.T) {
	repository := &recordingImageRepository{putErr: errors.New("S3 unavailable")}
	service := NewImageService(passthroughImageProcessor{}, repository)
	ctx := WithAuthenticatedAccount(t.Context(), entities.Account{ID: uuid.New()})

	_, err := service.UploadImage(ctx, bytes.NewReader([]byte("image")))
	if !errors.Is(err, ErrFailedToStoreImage) {
		t.Fatalf("UploadImage() error = %v, want ErrFailedToStoreImage", err)
	}
}
