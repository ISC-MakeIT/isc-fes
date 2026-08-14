package routers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/utils"
)

func (s *Server) GetVisibleStores(c *gin.Context) {
	stores, err := s.store.GetVisibleStores(c.Request.Context())
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusOK, GetVisibleStoresResponse{
		Total: len(stores),
		Data: utils.Map(stores, func(s entities.StoreOutput) Store {
			return Store{
				Id:           s.ID,
				Name:         s.Name,
				Room:         s.Room,
				Description:  s.Description,
				ImageUrl:     s.ImageURL,
				ReviewStatus: StoreReviewStatus(s.ReviewStatus),
			}
		}),
	})
}

func (s *Server) GetApprovedStoreByID(c *gin.Context, storeID uuid.UUID) {
	store, err := s.store.GetApprovedStoreByID(c.Request.Context(), storeID)
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusOK, Store{
		Id:           store.ID,
		Name:         store.Name,
		Room:         store.Room,
		Description:  store.Description,
		ImageUrl:     store.ImageURL,
		ReviewStatus: StoreReviewStatus(store.ReviewStatus),
	})
}
