package routers

import (
	"errors"
	"mime/multipart"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/isc-makeit/isc-fes/backend/routers/validators"
	"github.com/isc-makeit/isc-fes/backend/services"
)

type uploadImageForm struct {
	Image *multipart.FileHeader `form:"image" binding:"required"`
}

func (s *Server) UploadImage(c *gin.Context) {
	c.Request.Body = http.MaxBytesReader(
		c.Writer,
		c.Request.Body,
		maxRequestBodySize,
	)

	var form uploadImageForm
	bindErr := c.ShouldBind(&form)
	image, err := validators.ValidateRequireImageRequestBody(c, form.Image, bindErr, validators.ImageValidationConfig{
		MaxImageSize:       maxImageSize,
		MaxRequestBodySize: maxRequestBodySize,
	})
	if err != nil {
		statusCode, message := validators.MapValidationErrorToHTTPStatusCode(err)
		c.JSON(statusCode, ErrorResponse{Message: message})
		return
	}
	defer image.Close()

	imageObjectKey, err := s.image.UploadImage(c.Request.Context(), image)
	if err != nil {
		s.handleImageUploadError(c, err)
		return
	}

	c.JSON(http.StatusCreated, UploadImageResponse{
		ImageObjectKey: imageObjectKey.String(),
	})
}

func (s *Server) handleImageUploadError(c *gin.Context, err error) {
	switch {
	case errors.Is(err, services.ErrImageTooLarge):
		c.JSON(http.StatusRequestEntityTooLarge, ErrorResponse{
			Message: "画像が大きすぎます。",
		})
	case errors.Is(err, services.ErrUnsupportedImageFormat):
		c.JSON(http.StatusUnsupportedMediaType, ErrorResponse{
			Message: "対応していない画像形式です。JPEG、PNG、WebPを使用してください。",
		})
	case errors.Is(err, services.ErrEmptyImage),
		errors.Is(err, services.ErrInvalidImage),
		errors.Is(err, services.ErrImageDimensionsExceeded),
		errors.Is(err, services.ErrProcessedImageTooLarge):
		c.JSON(http.StatusUnprocessableEntity, ErrorResponse{
			Message: "画像の内容が不正です。",
		})
	case errors.Is(err, services.ErrFailedToStoreImage):
		c.JSON(http.StatusServiceUnavailable, ErrorResponse{
			Message: "画像ストレージが一時的に利用できません。",
		})
	default:
		s.handleCommonServiceErrors(c, err)
	}
}
