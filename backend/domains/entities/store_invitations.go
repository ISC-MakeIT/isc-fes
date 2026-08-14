package entities

import (
	"time"

	"github.com/google/uuid"
)

// 店舗のメンバー招待リンク
type StoreInvitation struct {
	ID        uuid.UUID
	StoreID   uuid.UUID
	Role      StoreMemberRole
	MaxUses   *int32
	UseCount  int32
	UpdatedAt time.Time
	CreatedAt time.Time
}

// 店舗のメンバー招待リンクを発行可能かどうか
// 店舗マネージャーのみ発行可能
func CanCreateStoreInvitation(member StoreMember) bool {
	return member.Role == StoreMemberRoleManager
}
