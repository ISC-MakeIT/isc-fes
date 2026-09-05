package menus

import (
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

type MenuImageObjectKey = entities.ImageObjectKey

func NewMenuImageObjectKey(imageID uuid.UUID) MenuImageObjectKey {
	return entities.NewImageObjectKey(imageID)
}
