package api

import (
	"errors"
	"mime/multipart"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/internal/domain/entities"
	"github.com/isc-makeit/isc-fes/backend/internal/service"
)

func (s *Server) GetStoreApplications(c *gin.Context) {
	ctx := c.Request.Context()

	applications, err := s.store.GetStoreApplications(ctx)
	if err != nil {
		handleCommonServiceErrors(c, err)
		return
	}

	resApplications := make([]StoreApplication, 0, len(applications))
	for _, application := range applications {
		resApplications = append(resApplications, StoreApplication{
			Id:           application.ID,
			Name:         application.Name,
			Description:  application.Description,
			Room:         application.Room,
			ImageUrl:     application.ImageURL,
			ReviewStatus: StoreReviewStatus(application.ReviewStatus),
			SubmittedAt:  application.SubmittedAt,
		})
	}

	c.JSON(http.StatusOK, GetStoreApplicationsResponse{
		Total: len(applications),
		Data:  resApplications,
	})
}

// TODO: リクエスト上限、画像サイズ、サービスエラーの HTTP 変換をハンドラーテストで網羅する。
func (s *Server) CreateStoreApplication(c *gin.Context) {
	ctx := c.Request.Context()

	const (
		maxImageSize       = 10 << 20 // 10 MiB
		maxMultipartMargin = 1 << 20  // 1 MiB
		maxRequestBodySize = maxImageSize + maxMultipartMargin
	)

	// TODO: 認証ミドルウェアでアカウントを確定してから multipart body を解析し、未認証リクエストの解析コストを避ける。
	c.Request.Body = http.MaxBytesReader(
		c.Writer,
		c.Request.Body,
		maxRequestBodySize,
	)

	var form createStoreApplicationForm
	if err := c.ShouldBind(&form); err != nil {
		// TODO: *http.MaxBytesError を errors.As で判定し、リクエスト上限超過時は 400 ではなく 413 を返す。
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Message: "リクエスト形式が不正です。",
		})
		return
	}

	if form.Image.Size > maxImageSize {
		c.JSON(http.StatusRequestEntityTooLarge, ErrorResponse{
			Message: "画像が大きすぎます。10 MiB 以下にしてください",
		})
		return
	}

	if form.Image.Size == 0 {
		c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
			Message: "画像ファイルが空です。",
		})
		return
	}

	image, err := form.Image.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Message: "画像を読み込めませんでした。",
		})
		return
	}
	defer image.Close()

	storeApplication, err := s.store.CreateStoreApplication(ctx, service.CreateStoreApplicationServiceInput{
		Name:        form.Name,
		Description: form.Description,
		Room:        form.Room,
		ImageReader: image,
	})
	if err != nil {
		// TODO: 未認証は 401、非対応画像は 415、画像不正は 422、S3 障害は 503 へ個別にマッピングする。
		handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusCreated, CreateStoreApplicationResponse{
		Id:           storeApplication.ID,
		ReviewStatus: StoreReviewStatus(storeApplication.ReviewStatus),
		SubmittedAt:  storeApplication.SubmittedAt,
	})
}

type createStoreApplicationForm struct {
	Name        string                `form:"name" binding:"required,max=100"`
	Room        string                `form:"room" binding:"required,max=50"`
	Description string                `form:"description" binding:"required,max=1000"`
	Image       *multipart.FileHeader `form:"image" binding:"required"`
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
		if errors.Is(err, service.ErrInvalidStoreReviewStatusTransition) {
			c.JSON(http.StatusConflict, ErrorResponse{
				Message: "不正なレビュー状態の遷移です",
			})
			return
		}

		handleCommonServiceErrors(c, err, CommonErrorMessages{
			NotFound: "店舗が見つかりません",
		})
		return
	}

	c.JSON(http.StatusOK, UpdateStoreApplicationReviewStatusResponse{
		Id:           storeID,
		ReviewStatus: body.ReviewStatus,
	})
}
