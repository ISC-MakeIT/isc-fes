package api

import (
	"errors"
	"log"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/jackc/pgx/v5"
	openapi_types "github.com/oapi-codegen/runtime/types"
)

func (s *Server) GetMe(c *gin.Context) {
	ctx := c.Request.Context()

	accountID, err := s.sessions.AccountID(ctx)
	if err != nil {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Message: "authentication required",
		})
		return
	}

	account, err := s.accountService.GetAccountByID(ctx, accountID)
	if errors.Is(err, pgx.ErrNoRows) {
		// アカウントは存在しないので、残っているセッションも破棄する。
		if destroyErr := s.sessions.SignOut(ctx); destroyErr != nil {
			log.Printf("destroy stale account session: %v", destroyErr)
		}

		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Message: "authentication required",
		})
		return
	}

	if err != nil {
		log.Printf("get current account: %v", err)

		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Message: "failed to get current account",
		})
		return
	}

	c.JSON(http.StatusOK, MeResponse{
		Id:          openapi_types.UUID(account.ID),
		Email:       openapi_types.Email(account.Email),
		DisplayName: account.DisplayName,
		PictureUrl:  account.PictureURL,
		Role:        MeResponseRole(account.Role),
		StoreId:     account.StoreID,
	})
}
