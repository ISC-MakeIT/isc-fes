package services

import (
	"context"

	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
)

type ImageURLGenerator interface {
	GenerateStoreImageURL(ctx context.Context, objectKey entities.StoreImageObjectKey) (string, error)
	GenerateMenuImageURL(ctx context.Context, objectKey menus.MenuImageObjectKey) (string, error)
}
