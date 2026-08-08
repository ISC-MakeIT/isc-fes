package service

import (
	"context"

	"github.com/isc-makeit/isc-fes/backend/internal/domain/entities"
)

type ImageURLGenerator interface {
	GenerateStoreImageURL(ctx context.Context, objectKey entities.StoreImageObjectKey) (string, error)
}
