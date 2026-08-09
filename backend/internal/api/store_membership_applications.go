package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/internal/domain/entities"
	"github.com/isc-makeit/isc-fes/backend/internal/utils"
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

	c.JSON(http.StatusOK, GetStoreMembershipApplicationsResponse{
		Total: len(applications),
		Data: utils.Map(applications, func(a entities.StoreMembershipApplication) StoreMembershipApplication {
			return StoreMembershipApplication{
				Id:              a.ID,
				StoreId:         a.StoreID,
				AccountId:       a.AccountID,
				Status:          StoreMembershipApplicationStatus(a.Status),
				ReviewedBy:      a.ReviewedBy,
				ReviewedAt:      a.ReviewedAt,
				RejectionReason: a.RejectionReason,
				SubmittedAt:     a.SubmittedAt,
			}
		}),
	})
}
