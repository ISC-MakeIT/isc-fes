package entities

import (
	"time"

	"github.com/google/uuid"
)

// Review はアプリの利用体験に対する評価。
// 投稿者が削除されても、レビュー内容は残る。
type Review struct {
	ID        uuid.UUID
	GuestID   *uuid.UUID
	AccountID *uuid.UUID
	Rating    int32
	Comment   *string
	Trigger   *string
	CreatedAt time.Time
}
