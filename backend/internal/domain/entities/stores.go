package entities

import (
	"strings"
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
	ImageObjectKey StoreImageObjectKey
	ReviewStatus   StoreReviewStatus
	SubmittedAt    time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type StoreOutput struct {
	ID             uuid.UUID
	Name           string
	Room           string
	Description    string
	ImageObjectKey StoreImageObjectKey
	ImageURL       string
	ReviewStatus   StoreReviewStatus
	SubmittedAt    time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

type StoreImageObjectKey string

const (
	storeImageObjectKeyPrefix = "stores/"
	storeImageObjectKeySuffix = "/image"
)

func NewStoreImageObjectKey(storeID uuid.UUID) StoreImageObjectKey {
	return StoreImageObjectKey(storeImageObjectKeyPrefix + storeID.String() + storeImageObjectKeySuffix)
}

func (k StoreImageObjectKey) String() string {
	return string(k)
}

func (k StoreImageObjectKey) IsValid() bool {
	if !strings.HasPrefix(string(k), storeImageObjectKeyPrefix) {
		return false
	}
	if !strings.HasSuffix(string(k), storeImageObjectKeySuffix) {
		return false
	}

	// storeID が UUID 形式であることを確認
	storeIDStr := strings.TrimPrefix(string(k), storeImageObjectKeyPrefix)
	storeIDStr = strings.TrimSuffix(storeIDStr, storeImageObjectKeySuffix)
	_, err := uuid.Parse(storeIDStr)
	if err != nil {
		return false
	}
	return true
}
