package api

import (
	"errors"
	"mime/multipart"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domain/entities"
	"github.com/isc-makeit/isc-fes/backend/service"
	"github.com/isc-makeit/isc-fes/backend/utils"
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
		Data: utils.Map(applications, func(a entities.StoreOutput) StoreApplication {
			return StoreApplication{
				Id:           a.ID,
				Name:         a.Name,
				Description:  a.Description,
				Room:         a.Room,
				ImageUrl:     a.ImageURL,
				ReviewStatus: StoreReviewStatus(a.ReviewStatus),
				SubmittedAt:  a.SubmittedAt,
			}
		}),
	})
}

// TODO: リクエスト上限、画像サイズ、サービスエラーの HTTP 変換をハンドラーテストで網羅する。
func (s *Server) CreateStoreApplication(c *gin.Context) {
	ctx := c.Request.Context()

	const (
		maxImageSize       = 10 << 20 // 画像本体の上限
		maxMultipartMargin = 1 << 20  // マルチパート形式の付加情報に許容する余白
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
		var maxBytesError *http.MaxBytesError
		if errors.As(err, &maxBytesError) {
			c.JSON(http.StatusRequestEntityTooLarge, ErrorResponse{
				Message: "リクエストが大きすぎます。",
			})
			return
		}

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
		switch {
		case errors.Is(err, service.ErrImageTooLarge):
			c.JSON(http.StatusRequestEntityTooLarge, ErrorResponse{
				Message: "画像が大きすぎます。",
			})
			return
		case errors.Is(err, service.ErrUnsupportedImageFormat):
			c.JSON(http.StatusUnsupportedMediaType, ErrorResponse{
				Message: "対応していない画像形式です。JPEG、PNG、WebPを使用してください。",
			})
			return
		case errors.Is(err, service.ErrEmptyImage),
			errors.Is(err, service.ErrInvalidImage),
			errors.Is(err, service.ErrImageDimensionsExceeded),
			errors.Is(err, service.ErrProcessedImageTooLarge):
			c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
				Message: "画像の内容が不正です。",
			})
			return
		case errors.Is(err, service.ErrFailedToStoreImage):
			c.JSON(http.StatusServiceUnavailable, ErrorResponse{
				Message: "画像ストレージが一時的に利用できません。",
			})
			return
		}

		s.handleCommonServiceErrors(c, err)
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
