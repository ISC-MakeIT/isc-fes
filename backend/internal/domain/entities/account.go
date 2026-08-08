package entities

import (
	"time"

	"github.com/google/uuid"
)

type Role string

const (
	RoleMember Role = "member"
	RoleAdmin  Role = "admin"
)

func (r Role) IsValid() bool {
	switch r {
	case RoleMember, RoleAdmin:
		return true
	default:
		return false
	}
}

// アカウント
// Google ログインをしたユーザーは必ず Account を持つ
type Account struct {
	ID          uuid.UUID
	GoogleSub   string
	Email       string
	DisplayName string
	PictureURL  *string
	Role        Role
	LastLoginAt time.Time
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

// 店舗申請のレビュー権限を持つかどうかを判定する
func (a *Account) CanUpdateStoreReviewStatus() bool {
	return a.Role == RoleAdmin
}
