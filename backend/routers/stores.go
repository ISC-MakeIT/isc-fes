package routers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/isc-makeit/isc-fes/backend/utils"
)

func (s *Server) GetVisibleStores(c *gin.Context, params GetVisibleStoresParams) {
	stores, err := s.store.GetVisibleStores(c.Request.Context(), params.MemberOnly != nil && *params.MemberOnly)
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusOK, GetVisibleStoresResponse{
		Total: len(stores),
		Data:  utils.Map(stores, toStoreResponse),
	})
}

func (s *Server) GetApprovedStoreByID(c *gin.Context, storeID uuid.UUID) {
	store, err := s.store.GetApprovedStoreByID(c.Request.Context(), storeID)
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusOK, toStoreResponse(store))
}

func (s *Server) UpdateStore(c *gin.Context, storeID uuid.UUID) {
	var input UpdateStoreJSONRequestBody
	if err := c.ShouldBindJSON(&input); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{Message: "リクエスト形式が不正です。"})
		return
	}

	update := services.UpdateStoreInput{
		OrderEnabled:    input.OrderEnabled,
		Closed:          input.Closed,
		Room:            input.Room,
		Description:     input.Description,
		AllergenIDs:     (*[]uuid.UUID)(input.AllergenIds),
		CongestionLevel: (*entities.StoreCongestionLevel)(input.CongestionLevel),
	}
	if input.ImageObjectKey != nil {
		key := entities.ImageObjectKey(*input.ImageObjectKey)
		update.ImageObjectKey = &key
	}

	store, err := s.store.UpdateStore(c.Request.Context(), storeID, update)
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusOK, toStoreResponse(store))
}

func toStoreResponse(store entities.StoreOutput) Store {
	return Store{
		OrderEnabled:    store.OrderEnabled,
		Id:              store.ID,
		Name:            store.Name,
		Room:            store.Room,
		Description:     store.Description,
		ImageUrl:        store.ImageURL,
		ReviewStatus:    StoreReviewStatus(store.ReviewStatus),
		Allergens:       utils.Map(store.Allergens, toAllergen),
		ClosedAt:        store.ClosedAt,
		CongestionLevel: StoreCongestionLevel(store.CongestionLevel),
	}
}
