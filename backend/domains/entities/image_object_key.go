package entities

import (
	"strings"

	"github.com/google/uuid"
)

type ImageObjectKey string

const imageObjectKeyPrefix = "images/"

func NewImageObjectKey(imageID uuid.UUID) ImageObjectKey {
	return ImageObjectKey(imageObjectKeyPrefix + imageID.String())
}

func (k ImageObjectKey) String() string {
	return string(k)
}

func (k ImageObjectKey) IsValid() bool {
	if !strings.HasPrefix(string(k), imageObjectKeyPrefix) {
		return false
	}

	imageID := strings.TrimPrefix(string(k), imageObjectKeyPrefix)
	parsedImageID, err := uuid.Parse(imageID)
	return err == nil && parsedImageID.String() == imageID
}
