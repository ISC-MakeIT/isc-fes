package entities

import (
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/internal/utils"
)

type StoreMembershipApplicationStatus string

const (
	StoreMembershipApplicationStatusPending  StoreMembershipApplicationStatus = "pending"
	StoreMembershipApplicationStatusApproved StoreMembershipApplicationStatus = "approved"
	StoreMembershipApplicationStatusRejected StoreMembershipApplicationStatus = "rejected"
)

type StoreMembershipApplication struct {
	ID              uuid.UUID
	StoreID         uuid.UUID
	AccountID       uuid.UUID
	Status          StoreMembershipApplicationStatus
	ReviewedBy      *uuid.UUID
	ReviewedAt      *time.Time
	RejectionReason *string
	SubmittedAt     time.Time
}

// 特定アカウントが、特定の店舗のメンバーシップ申請を閲覧できるかどうかを判定する
// 特定アカウントが管理者権限を持っている場合は、すべての店舗のメンバーシップ申請を閲覧可能
// 特定アカウントが管理者権限を持っていない場合は、特定アカウントが特定店舗のメンバーシップを持っている場合のみ閲覧可能
func CanSeeStoreMembershipApplications(account Account, store Store, storeMembers []StoreMember) bool {
	if account.Role == RoleAdmin {
		return true
	}

	// 特定 Account に紐づいている StoreMember でも、特定 Store に紐づいている StoreMember が渡されたも大丈夫なように、storeMembers をフィルタリングする
	myStoreMembership := utils.Filter(storeMembers, func(m StoreMember) bool {
		return m.AccountID == account.ID && m.StoreID == store.ID
	})
	if len(myStoreMembership) > 1 {
		// 一つの店舗に対して、同じアカウントが複数のメンバーシップを持つことは想定していないので、エラーとして扱う
		panic(fmt.Sprintf("Account %s has multiple memberships for Store %s", account.ID, store.ID))
	}
	if len(myStoreMembership) == 0 {
		return false
	}

	myMembership := myStoreMembership[0]
	if myMembership.Role == StoreMemberRoleManager {
		return true
	}
	return false
}
