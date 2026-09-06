package routers

import (
	"errors"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/isc-makeit/isc-fes/backend/utils"
)

const (
	maxImageSize       = 10 << 20 // 画像本体の上限
	maxMultipartMargin = 1 << 20  // マルチパート形式の付加情報に許容する余白
	maxRequestBodySize = maxImageSize + maxMultipartMargin
)

func (s *Server) GetStoreApplications(c *gin.Context) {
	ctx := c.Request.Context()

	applications, err := s.store.GetStoreApplications(ctx)
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusOK, GetStoreApplicationsResponse{
		Total: len(applications),
		Data:  utils.Map(applications, toStoreApplicationResponse),
	})
}

func toStoreApplicationResponse(application entities.StoreOutput) StoreApplication {
	return StoreApplication{
		Id:           application.ID,
		Name:         application.Name,
		Description:  application.Description,
		Room:         application.Room,
		ImageUrl:     application.ImageURL,
		ReviewStatus: StoreReviewStatus(application.ReviewStatus),
		SubmittedAt:  application.SubmittedAt,
		Allergens:    utils.Map(application.Allergens, toAllergen),
	}
}

func (s *Server) CreateStoreApplication(c *gin.Context) {
	ctx := c.Request.Context()

	var body CreateStoreApplicationInput
	if err := c.ShouldBindJSON(&body); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Message: "リクエスト形式が不正です。",
		})
		return
	}

	storeApplication, err := s.store.CreateStoreApplication(ctx, services.CreateStoreApplicationServiceInput{
		Name:           body.Name,
		Description:    body.Description,
		Room:           body.Room,
		ImageObjectKey: entities.ImageObjectKey(body.ImageObjectKey),
	})
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusCreated, CreateStoreApplicationResponse{
		Id:           storeApplication.ID,
		ReviewStatus: StoreReviewStatus(storeApplication.ReviewStatus),
		SubmittedAt:  storeApplication.SubmittedAt,
	})
}

func (s *Server) UpdateStoreApplicationReviewStatus(c *gin.Context, storeID uuid.UUID) {
	ctx := c.Request.Context()

	var body UpdateStoreApplicationReviewStatusJSONBody
	if err := c.ShouldBind(&body); err != nil || !body.ReviewStatus.Valid() {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Message: "不正なリクエストです",
		})
		return
	}

	err := s.store.UpdateStoreApplicationReviewStatus(ctx, storeID, entities.StoreReviewStatus(body.ReviewStatus))
	if err != nil {
		if errors.Is(err, services.ErrInvalidStoreReviewStatusTransition) {
			c.JSON(http.StatusConflict, ErrorResponse{
				Message: "不正なレビュー状態の遷移です",
			})
			return
		}

		s.handleCommonServiceErrors(c, err, CommonErrorMessages{
			NotFound: "店舗が見つかりません",
		})
		return
	}

	c.JSON(http.StatusOK, UpdateStoreApplicationReviewStatusResponse{
		Id:           storeID,
		ReviewStatus: body.ReviewStatus,
	})
}
