package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

func (s *Server) GetStoreMembershipApplicationsByStoreID(c *gin.Context, storeID uuid.UUID) {
	ctx := c.Request.Context()

	applications, err := s.storeMembershipApplications.GetStoreMembershipApplicationsByStoreID(ctx, storeID)
	if err != nil {
		handleCommonServiceErrors(c, err, CommonErrorMessages{
			NotFound: "店舗が見つかりません",
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
