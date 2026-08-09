package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/internal/service"
)

func (s *Server) GetStoreMembershipApplicationsByStoreID(c *gin.Context, storeID uuid.UUID) {
	ctx := c.Request.Context()

	applications, err := s.storeMembershipApplications.GetStoreMembershipApplicationsByStoreID(ctx, storeID)
	if err != nil {
		if err == service.ErrUnauthenticated {
			c.JSON(http.StatusUnauthorized, ErrorResponse{
				Message: "未ログイン",
			})
			return
		}
		if err == service.ErrForbidden {
			c.JSON(http.StatusForbidden, ErrorResponse{
				Message: "権限不足",
			})
			return
		}
		if err == service.ErrNotFound {
			c.JSON(http.StatusNotFound, ErrorResponse{
				Message: "店舗が見つかりません",
			})
			return
		}

		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Message: "店舗のメンバー申請一覧の取得に失敗しました",
		})
		return
	}

	resApplications := make([]StoreMembershipApplication, 0, len(applications))
	for _, application := range applications {
		resApplications = append(resApplications, StoreMembershipApplication{
			Id:              application.ID,
			StoreId:         application.StoreID,
			AccountId:       application.AccountID,
			Status:          StoreMembershipApplicationStatus(application.Status),
			ReviewedBy:      application.ReviewedBy,
			ReviewedAt:      application.ReviewedAt,
			RejectionReason: application.RejectionReason,
			SubmittedAt:     application.SubmittedAt,
		})
	}

	c.JSON(http.StatusOK, GetStoreMembershipApplicationsResponse{
		Total: len(applications),
		Data:  resApplications,
	})
}
