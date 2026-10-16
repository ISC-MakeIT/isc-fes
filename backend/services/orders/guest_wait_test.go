package orders

import (
	"errors"
	"testing"
	"time"
)

func TestCheckGuestOrderWait(t *testing.T) {
	createdAt := time.Date(2026, 10, 31, 10, 0, 0, 0, time.FixedZone("JST", 9*60*60))
	wait := GuestOrderWaitMinutes * time.Minute
	for _, test := range []struct {
		name    string
		elapsed time.Duration
		want    error
	}{
		{"just created", 0, ErrGuestOrderTooEarly},
		{"before boundary", wait - time.Nanosecond, ErrGuestOrderTooEarly},
		{"at boundary", wait, nil},
		{"after boundary", wait + time.Nanosecond, nil},
		{"future created_at", -time.Minute, ErrGuestOrderTooEarly},
	} {
		t.Run(test.name, func(t *testing.T) {
			if err := CheckGuestOrderWait(createdAt, createdAt.Add(test.elapsed).UTC()); !errors.Is(err, test.want) {
				t.Fatalf("error = %v, want %v", err, test.want)
			}
		})
	}
}
