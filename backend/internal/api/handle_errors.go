package api

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/isc-makeit/isc-fes/backend/internal/service"
)

type CommonErrorMessages struct {
	Unauthenticated string
	Forbidden       string
	NotFound        string
	Internal        string
}

var defaultCommonErrorMessages = CommonErrorMessages{
	Unauthenticated: "未ログインです",
	Forbidden:       "この操作を行う権限がありません",
	NotFound:        "対象が見つかりません",
	Internal:        "サーバー内部でエラーが発生しました",
}

func (m CommonErrorMessages) withDefaults() CommonErrorMessages {
	if m.Unauthenticated == "" {
		m.Unauthenticated = defaultCommonErrorMessages.Unauthenticated
	}
	if m.Forbidden == "" {
		m.Forbidden = defaultCommonErrorMessages.Forbidden
	}
	if m.NotFound == "" {
		m.NotFound = defaultCommonErrorMessages.NotFound
	}
	if m.Internal == "" {
		m.Internal = defaultCommonErrorMessages.Internal
	}

	return m
}

func (s *Server) handleCommonServiceErrors(c *gin.Context, err error, options ...CommonErrorMessages) {
	messages := defaultCommonErrorMessages

	if len(options) > 0 {
		messages = options[0].withDefaults()
	}

	switch {
	case errors.Is(err, service.ErrUnauthenticated):
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Message: messages.Unauthenticated,
		})
		return
	case errors.Is(err, service.ErrForbidden):
		c.JSON(http.StatusForbidden, ErrorResponse{
			Message: messages.Forbidden,
		})
		return
	case errors.Is(err, service.ErrNotFound):
		c.JSON(http.StatusNotFound, ErrorResponse{
			Message: messages.NotFound,
		})
		return
	default:
		log.Printf("%s", err.Error())
		if notifyErr := s.errorNotifier.Critical(c.Request.Context(), err.Error()); notifyErr != nil {
			log.Printf("failed to notify unexpected error: %v", notifyErr)
		}
		// TODO: 致命的なエラーは discord に通知するようにする
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Message: messages.Internal,
		})
		return
	}
}
