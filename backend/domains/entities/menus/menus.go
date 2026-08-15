package menus

import (
	"time"

	"github.com/google/uuid"
)

type Menu struct {
	ID             uuid.UUID
	StoreID        uuid.UUID
	Name           string
	Description    string
	UnitPrice      int32
	ImageObjectKey MenuImageObjectKey
	SoldOut        bool
	DeletedAt      *time.Time
	UpdatedAt      time.Time
	CreatedAt      time.Time
}

type MenuDisplay struct {
	ID          uuid.UUID
	StoreID     uuid.UUID
	Name        string
	Description string
	UnitPrice   int32
	ImageURL    string
	SoldOut     bool
	DeletedAt   *time.Time
	UpdatedAt   time.Time
	CreatedAt   time.Time
}
