package routers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/utils"
)

func (s *Server) GetStoreMembers(c *gin.Context, storeID uuid.UUID) {
	members, err := s.storeMember.GetStoreMembersByStoreID(c.Request.Context(), storeID)
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusOK, GetStoreMembersResponse{
		Total: len(members),
		Data: utils.Map(members, func(m entities.StoreMember) StoreMember {
			return StoreMember{
				StoreId:     m.StoreID,
				AccountId:   m.AccountID,
				Role:        StoreMemberRole(m.Role),
				JoinedAt:    m.JoinedAt,
				DisplayName: m.DisplayName,
				PictureUrl:  m.PictureURL,
			}
		}),
	})
}

func (s *Server) GetStoreMemberByStoreIDAndAccountID(c *gin.Context, storeID uuid.UUID, accountID uuid.UUID) {
	member, err := s.storeMember.GetStoreMemberByAccountIDAndStoreID(c.Request.Context(), accountID, storeID)
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusOK, StoreMember{
		StoreId:     member.StoreID,
		AccountId:   member.AccountID,
		Role:        StoreMemberRole(member.Role),
		JoinedAt:    member.JoinedAt,
		DisplayName: member.DisplayName,
		PictureUrl:  member.PictureURL,
	})
}

func (s *Server) RemoveStoreMember(c *gin.Context, storeID uuid.UUID, accountID uuid.UUID) {
	err := s.storeMember.RemoveStoreMemberByAccountIDAndStoreID(c.Request.Context(), accountID, storeID)
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.Status(http.StatusNoContent)
}
