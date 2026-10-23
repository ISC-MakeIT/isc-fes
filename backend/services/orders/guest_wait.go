package orders

import (
	"fmt"
	"time"

	"github.com/isc-makeit/isc-fes/backend/services"
)

// GuestOrderWaitMinutesはゲスト発行から新規注文までの待機時間。エラー文もこの値を使う。
const GuestOrderWaitMinutes = 1

var ErrGuestOrderTooEarly = fmt.Errorf("guest order wait has not elapsed: %w", services.ErrForbidden)

func CheckGuestOrderWait(createdAt, now time.Time) error {
	if now.Before(createdAt.Add(GuestOrderWaitMinutes * time.Minute)) {
		return ErrGuestOrderTooEarly
	}
	return nil
}
