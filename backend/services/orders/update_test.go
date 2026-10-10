package orders

import (
	"errors"
	"math"
	"reflect"
	"testing"
	"time"

	domain "github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/services"
)

func TestPrepareUpdate(t *testing.T) {
	created := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	ready := created.Add(time.Minute)
	pendingOrder := domain.Order{Status: domain.OrderStatusPending, Version: 1, CreatedAt: created, UpdatedAt: created}
	readyOrder := pendingOrder
	readyOrder.Status, readyOrder.Version, readyOrder.ReadyAt, readyOrder.UpdatedAt = domain.OrderStatusReady, 2, &ready, ready
	overflow := pendingOrder
	overflow.Version = math.MaxInt32
	for _, test := range []struct {
		name    string
		order   domain.Order
		status  domain.OrderStatus
		version int32
		at      time.Time
		want    error
	}{
		{"ready", pendingOrder, domain.OrderStatusReady, 1, ready, nil},
		{"completed", readyOrder, domain.OrderStatusCompleted, 2, ready.Add(time.Minute), nil},
		{"cancel exactly at boundary", readyOrder, domain.OrderStatusCancelled, 2, ready.Add(domain.CancellationDelay), nil},
		{"cancel too early", readyOrder, domain.OrderStatusCancelled, 2, ready.Add(domain.CancellationDelay - time.Nanosecond), ErrCancelTooEarly},
		{"outdated version", readyOrder, domain.OrderStatusCompleted, 1, ready.Add(time.Minute), ErrOrderVersionConflict},
		{"replay ignores outdated version and time", readyOrder, domain.OrderStatusReady, 1, time.Time{}, nil},
		{"invalid transition", pendingOrder, domain.OrderStatusCompleted, 1, ready, ErrOrderStateConflict},
		{"invalid status", pendingOrder, "invalid", 1, ready, services.ErrInvalidInput},
		{"invalid version even on replay", readyOrder, domain.OrderStatusReady, 0, ready, services.ErrInvalidInput},
		{"overflow", overflow, domain.OrderStatusReady, math.MaxInt32, ready, ErrOrderStateConflict},
	} {
		t.Run(test.name, func(t *testing.T) {
			got, err := PrepareUpdate(test.order, test.status, test.version, test.at)
			if !errors.Is(err, test.want) {
				t.Fatalf("error = %v, want %v", err, test.want)
			}
			if err != nil {
				return
			}
			if test.status == test.order.Status {
				if !reflect.DeepEqual(got, test.order) {
					t.Fatalf("replay changed order: %+v", got)
				}
			} else if got.Status != test.status || got.Version != test.order.Version+1 || !got.UpdatedAt.Equal(test.at) {
				t.Fatalf("unexpected update: %+v", got)
			}
		})
	}
}
