package api

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domain/entities"
	"github.com/isc-makeit/isc-fes/backend/utils"
)

func (s *Server) GetStoreMembershipApplicationsByStoreID(c *gin.Context, storeID uuid.UUID) {
	ctx := c.Request.Context()

	applications, err := s.storeMembershipApplications.GetStoreMembershipApplicationsByStoreID(ctx, storeID)
	if err != nil {
		s.handleCommonServiceErrors(c, err, CommonErrorMessages{
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

func (s *Server) GetMyStoreMembershipApplications(c *gin.Context) {
	ctx := c.Request.Context()

	applications, err := s.storeMembershipApplications.GetMyStoreMembershipApplications(ctx)
	if err != nil {
		s.handleCommonServiceErrors(c, err)
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
