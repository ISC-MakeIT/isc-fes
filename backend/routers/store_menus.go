package routers

import (
	"errors"
	"mime/multipart"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/isc-makeit/isc-fes/backend/routers/validators"
	"github.com/isc-makeit/isc-fes/backend/services"
	menu_service "github.com/isc-makeit/isc-fes/backend/services/store/menus"
	"github.com/isc-makeit/isc-fes/backend/utils"
)

func (s *Server) GetMenusByStoreID(c *gin.Context, storeID uuid.UUID) {
	menus, err := s.menu.GetMenusByStoreID(c.Request.Context(), storeID)
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusOK, GetMenusByStoreIDResponse{
		Total: len(menus),
		Data:  utils.Map(menus, toMenu),
	})
}

type CreateMenuForm struct {
	Name        string                `form:"name" binding:"required"`
	Description string                `form:"description" binding:"required"`
	UnitPrice   *int32                `form:"unitPrice" binding:"required,gte=0"`
	ToppingIds  []uuid.UUID           `form:"toppingIds[]"`
	Image       *multipart.FileHeader `form:"image" binding:"required"`
}

func (s *Server) CreateMenu(c *gin.Context, storeID uuid.UUID) {
	ctx := c.Request.Context()

	// TODO: 認証ミドルウェアでアカウントを確定してから multipart body を解析し、未認証リクエストの解析コストを避ける。
	c.Request.Body = http.MaxBytesReader(
		c.Writer,
		c.Request.Body,
		maxRequestBodySize,
	)

	var form CreateMenuForm
	bindErr := c.ShouldBind(&form)
	image, err := validators.ValidateImageRequestBody(c, form.Image, bindErr, validators.ImageValidationConfig{
		MaxImageSize:       maxImageSize,
		MaxRequestBodySize: maxRequestBodySize,
	})
	if err != nil {
		statusCode, message := validators.MapValidationErrorToHTTPStatusCode(err)
		c.JSON(statusCode, ErrorResponse{
			Message: message,
		})
		return
	}
	defer image.Close()

	menu, err := s.menu.CreateMenu(ctx, storeID, menu_service.CreateMenuInput{
		Name:        form.Name,
		Description: form.Description,
		UnitPrice:   *form.UnitPrice,
		ToppingIds:  form.ToppingIds,
		ImageReader: image,
	})
	if err != nil {
		switch {
		case errors.Is(err, services.ErrImageTooLarge):
			c.JSON(http.StatusRequestEntityTooLarge, ErrorResponse{
				Message: "画像が大きすぎます。",
			})
			return
		case errors.Is(err, services.ErrUnsupportedImageFormat):
			c.JSON(http.StatusUnsupportedMediaType, ErrorResponse{
				Message: "対応していない画像形式です。JPEG、PNG、WebPを使用してください。",
			})
			return
		case errors.Is(err, services.ErrEmptyImage),
			errors.Is(err, services.ErrInvalidImage),
			errors.Is(err, services.ErrImageDimensionsExceeded),
			errors.Is(err, services.ErrProcessedImageTooLarge):
			c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
				Message: "画像の内容が不正です。",
			})
			return
		case errors.Is(err, services.ErrFailedToStoreImage):
			c.JSON(http.StatusServiceUnavailable, ErrorResponse{
				Message: "画像ストレージが一時的に利用できません。",
			})
			return
		}

		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusCreated, toMenu(menu))
}

func toMenu(menuDisplay menus.MenuDisplay) Menu {
	return Menu{
		Id:          menuDisplay.ID,
		StoreId:     menuDisplay.StoreID,
		Name:        menuDisplay.Name,
		Description: menuDisplay.Description,
		UnitPrice:   menuDisplay.UnitPrice,
		ImageUrl:    menuDisplay.ImageURL,
		SoldOut:     menuDisplay.SoldOut,
		UpdatedAt:   menuDisplay.UpdatedAt,
		CreatedAt:   menuDisplay.CreatedAt,
	}
}
