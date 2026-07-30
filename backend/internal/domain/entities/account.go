package entities

import (
	"time"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/internal/db/sqlc"
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

func (a Account) New(dbAccount sqlc.Account) Account {
	return Account{
		ID:          dbAccount.ID,
		GoogleSub:   dbAccount.GoogleSub,
		Email:       dbAccount.Email,
		DisplayName: dbAccount.DisplayName,
		PictureURL:  dbAccount.PictureUrl,
		Role:        Role(dbAccount.Role),
		LastLoginAt: dbAccount.LastLoginAt.Time,
		CreatedAt:   dbAccount.CreatedAt.Time,
		UpdatedAt:   dbAccount.UpdatedAt.Time,
	}
}
