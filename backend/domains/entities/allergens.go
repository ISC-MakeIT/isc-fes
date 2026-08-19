package entities

import "github.com/google/uuid"

type Allergen struct {
	ID   uuid.UUID
	Name string
}
