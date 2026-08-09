package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/isc-makeit/isc-fes/backend/internal/domain/entities"
	"github.com/isc-makeit/isc-fes/backend/internal/utils"
)

func (s *Server) GetApprovedStores(c *gin.Context) {
	stores, err := s.store.GetApprovedStores(c.Request.Context())
	if err != nil {
		handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusOK, GetApprovedStoresResponse{
		Total: len(stores),
		Data: utils.Map(stores, func(s entities.StoreOutput) Store {
			return Store{
				Id:          s.ID,
				Name:        s.Name,
				Room:        s.Room,
				Description: s.Description,
				ImageUrl:    s.ImageURL,
			}
		}),
	})
}
