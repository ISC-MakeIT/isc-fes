package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

func (s *Server) GetApprovedStores(c *gin.Context) {
	stores, err := s.store.GetApprovedStores(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Message: "店舗の取得に失敗しました",
		})
		return
	}

	apiStores := make([]Store, 0, len(stores))
	for _, store := range stores {
		apiStores = append(apiStores, Store{
			Id:          store.ID,
			Name:        store.Name,
			Room:        store.Room,
			Description: store.Description,
			ImageUrl:    store.ImageURL,
		})
	}

	c.JSON(http.StatusOK, GetApprovedStoresResponse{
		Total: len(stores),
		Data:  apiStores,
	})
}
