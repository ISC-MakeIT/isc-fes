package rooms

import (
	"context"

	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

type RoomsService struct {
	repository RoomsRepository
}

func NewRoomsService(repository RoomsRepository) *RoomsService {
	return &RoomsService{
		repository: repository,
	}
}

func (s RoomsService) GetRooms(c context.Context) ([]entities.Room, error) {
	return s.repository.GetRooms(c)
}
