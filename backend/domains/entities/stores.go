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

// 店舗申請ステータスがある値に更新可能かどうかを判定する
// 例: pending -> approved は可能だが、approved -> pending は不可
func (s *StoreReviewStatus) CanUpdateTo(newStatus StoreReviewStatus) bool {
	switch *s {
	case StoreReviewStatusPending:
		return newStatus == StoreReviewStatusApproved || newStatus == StoreReviewStatusRejected
	case StoreReviewStatusApproved, StoreReviewStatusRejected:
		return false
	default:
		return false
	}
}

func (s StoreReviewStatus) String() string {
	return string(s)
}

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
	Allergens      []Allergen
}

type StoreMemberRole string

const (
	StoreMemberRoleManager StoreMemberRole = "manager"
	StoreMemberRoleStaff   StoreMemberRole = "staff"
)

func (r *StoreMemberRole) String() string {
	return string(*r)
}

type StoreMembership struct {
	StoreID   uuid.UUID
	AccountID uuid.UUID
	Role      StoreMemberRole
	JoinedAt  time.Time
}

type StoreMember struct {
	StoreID   uuid.UUID
	AccountID uuid.UUID
	Role      StoreMemberRole
	JoinedAt  time.Time

	// accounts から表示に関するデータを JOIN してとる
	// もっと情報が欲しい場合は AccountID から accounts を参照させる
	DisplayName string
	PictureURL  *string
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

func CanSeeStoreApplications(account Account) bool {
	return account.Role == RoleAdmin
}

// IsVisibleInPublic は、店舗がすべてのユーザー（未ログイン含む）から閲覧可能かどうかを判定する。
// 店舗が承認済みの場合は、すべてのユーザーから閲覧可能
func (s *Store) IsVisibleInPublic() bool {
	return s.ReviewStatus == StoreReviewStatusApproved
}

// IsMenuManagementAllowed は、店舗メンバーがメニュー管理を行えるかどうかを判定する。
// 店舗メンバーのロールが manager の場合のみ、メニュー管理を行える
func (m *StoreMembership) IsMenuManagementAllowed() bool {
	return m.Role == StoreMemberRoleManager
}

// IsMemberManagementAllowed は、店舗メンバーがメンバー管理を行えるかどうかを判定する。
// 店舗メンバーのロールが manager の場合のみ、メンバー管理を行える
func (m *StoreMembership) IsMemberManagementAllowed() bool {
	return m.Role == StoreMemberRoleManager
}
