package services

import (
	"context"

	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

type ImageURLGenerator interface {
	GenerateStoreImageURL(ctx context.Context, objectKey entities.StoreImageObjectKey) (string, error)
}
