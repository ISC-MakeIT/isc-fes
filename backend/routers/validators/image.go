package validators

import (
	"errors"
	"mime/multipart"
	"net/http"

	"github.com/gin-gonic/gin"
)

var (
	errTooLargeBody    = errors.New("リクエストが大きすぎます。")
	errBadRequest      = errors.New("リクエスト形式が不正です。")
	errTooLargeImage   = errors.New("画像が大きすぎます。10 MiB 以下にしてください")
	errEmptyImage      = errors.New("画像ファイルが空です。")
	errCannotOpenImage = errors.New("画像を読み込めませんでした。")
)

type ImageValidationConfig struct {
	MaxImageSize       int64
	MaxRequestBodySize int64
}

func ValidateImageRequestBody(c *gin.Context, img *multipart.FileHeader, bindError error, config ImageValidationConfig) (multipart.File, error) {
	// TODO: 認証ミドルウェアでアカウントを確定してから multipart body を解析し、未認証リクエストの解析コストを避ける。
	c.Request.Body = http.MaxBytesReader(
		c.Writer,
		c.Request.Body,
		config.MaxRequestBodySize,
	)

	if bindError != nil {
		var maxBytesError *http.MaxBytesError
		if errors.As(bindError, &maxBytesError) {
			return nil, errTooLargeBody
		}

		return nil, errBadRequest
	}

	if img.Size > config.MaxImageSize {
		return nil, errTooLargeImage
	}

	if img.Size == 0 {
		return nil, errEmptyImage
	}

	image, err := img.Open() // 関数利用側で defer image.Close() する
	if err != nil {
		return nil, errCannotOpenImage
	}

	return image, nil
}

func MapValidationErrorToHTTPStatusCode(err error) (int, string) {
	switch {
	case errors.Is(err, errTooLargeBody):
		return http.StatusRequestEntityTooLarge, err.Error()
	case errors.Is(err, errBadRequest):
		return http.StatusBadRequest, err.Error()
	case errors.Is(err, errTooLargeImage):
		return http.StatusRequestEntityTooLarge, err.Error()
	case errors.Is(err, errEmptyImage):
		return http.StatusUnprocessableEntity, err.Error()
	case errors.Is(err, errCannotOpenImage):
		return http.StatusBadRequest, err.Error()
	default:
		return http.StatusInternalServerError, "Internal Server Error"
	}
}
