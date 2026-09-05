package rooms

import (
	"context"

	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/isc-makeit/isc-fes/backend/services/rooms"
	"github.com/isc-makeit/isc-fes/backend/utils"
)

type RoomsRepository struct {
	queries *sqlc.Queries
}

func NewRoomsRepository(queries *sqlc.Queries) RoomsRepository {
	return RoomsRepository{
		queries: queries,
	}
}

func (r RoomsRepository) GetRooms(c context.Context) ([]entities.Room, error) {
	dbrooms, err := r.queries.GetRooms(c)
	return utils.Map(dbrooms, toRoom), err
}

func (r RoomsRepository) GetRoomByName(c context.Context, name string) (entities.Room, error) {
	dbroom, err := r.queries.GetRoomByName(c, name)
	return toRoom(dbroom), err
}

func toRoom(dbroom sqlc.Room) entities.Room {
	return entities.Room{
		Name: dbroom.Name,
	}
}

var _ rooms.RoomsRepository = (*RoomsRepository)(nil)
var _ services.RoomsRepository = (*RoomsRepository)(nil)
