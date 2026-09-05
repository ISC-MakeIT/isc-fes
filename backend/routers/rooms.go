package routers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/utils"
)

func (s *Server) GetRooms(c *gin.Context) {
	rooms, err := s.rooms.GetRooms(c.Request.Context())
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusOK, GetRoomsResponse{
		Total: len(rooms),
		Data:  utils.Map(rooms, toRoomResponse),
	})
}

func toRoomResponse(room entities.Room) Room {
	return Room{
		Name: room.Name,
	}
}
