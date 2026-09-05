package rooms

import (
	"context"

	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

type RoomsRepository interface {
	GetRooms(c context.Context) ([]entities.Room, error)
}
