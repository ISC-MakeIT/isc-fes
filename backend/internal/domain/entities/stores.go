package entities

import (
	"time"

	"github.com/google/uuid"
)

// 店舗申請のステータス
type StoreReviewStatus string

const (
	StoreReviewStatusPending  StoreReviewStatus = "pending"
	StoreReviewStatusApproved StoreReviewStatus = "approved"
	StoreReviewStatusRejected StoreReviewStatus = "rejected"
)

func (r StoreReviewStatus) IsValid() bool {
	switch r {
	case StoreReviewStatusPending, StoreReviewStatusApproved, StoreReviewStatusRejected:
		return true
	default:
		return false
	}
}

type Store struct {
	ID             uuid.UUID
	Name           string
	Room           string
	Description    string
	ImageObjectKey string
	ReviewStatus   StoreReviewStatus
	SubmittedAt    time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}
