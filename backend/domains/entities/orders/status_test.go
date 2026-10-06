package orders

import (
	"errors"
	"math"
	"reflect"
	"testing"
	"time"
)

func stateOrder(status OrderStatus) Order {
	created := time.Date(2026, 10, 1, 12, 0, 0, 0, time.UTC)
	ready := created.Add(time.Minute)
	completed := ready.Add(time.Minute)
	cancelled := ready.Add(CancellationDelay)
	o := Order{Status: status, Version: 1, CreatedAt: created, UpdatedAt: created}
	switch status {
	case OrderStatusReady:
		o.Version, o.ReadyAt, o.UpdatedAt = 2, &ready, ready
	case OrderStatusCompleted:
		o.Version, o.ReadyAt, o.CompletedAt, o.UpdatedAt = 3, &ready, &completed, completed
	case OrderStatusCancelled:
		o.Version, o.ReadyAt, o.CancelledAt, o.UpdatedAt = 3, &ready, &cancelled, cancelled
	}
	return o
}

func TestTransitionStateMatrix(t *testing.T) {
	statuses := []OrderStatus{OrderStatusPending, OrderStatusReady, OrderStatusCompleted, OrderStatusCancelled}
	for _, from := range statuses {
		for _, to := range statuses {
			t.Run(string(from)+"_to_"+string(to), func(t *testing.T) {
				original := stateOrder(from)
				at := original.CreatedAt.Add(time.Hour)
				got, err := original.Transition(to, at)
				allowed := from == to || (from == OrderStatusPending && to == OrderStatusReady) ||
					(from == OrderStatusReady && (to == OrderStatusCompleted || to == OrderStatusCancelled))
				if !allowed {
					if !errors.Is(err, ErrStateConflict) {
						t.Fatalf("error = %v, want ErrStateConflict", err)
					}
				} else if err != nil {
					t.Fatalf("Transition() error = %v", err)
				} else if from == to {
					if !reflect.DeepEqual(got, original) {
						t.Fatalf("replay changed order: %+v", got)
					}
				} else {
					if got.Status != to || got.Version != original.Version+1 || !got.UpdatedAt.Equal(at) {
						t.Fatalf("unexpected updated order: %+v", got)
					}
					var timestamp *time.Time
					switch to {
					case OrderStatusReady:
						timestamp = got.ReadyAt
					case OrderStatusCompleted:
						timestamp = got.CompletedAt
					case OrderStatusCancelled:
						timestamp = got.CancelledAt
					}
					if timestamp == nil || !timestamp.Equal(at) {
						t.Fatalf("transition timestamp = %v, want %v", timestamp, at)
					}
					if original.ReadyAt != nil && !got.ReadyAt.Equal(*original.ReadyAt) {
						t.Fatal("first ready timestamp changed")
					}
				}
				if !reflect.DeepEqual(original, stateOrder(from)) {
					t.Fatal("Transition mutated original order")
				}
			})
		}
	}
}

func TestCancellationBoundary(t *testing.T) {
	for _, test := range []struct {
		name  string
		delay time.Duration
		want  error
	}{
		{"before", CancellationDelay - time.Nanosecond, ErrCancelTooEarly},
		{"exact", CancellationDelay, nil},
		{"after", CancellationDelay + time.Nanosecond, nil},
	} {
		t.Run(test.name, func(t *testing.T) {
			o := stateOrder(OrderStatusReady)
			_, err := o.Transition(OrderStatusCancelled, o.ReadyAt.Add(test.delay))
			if !errors.Is(err, test.want) {
				t.Fatalf("error = %v, want %v", err, test.want)
			}
		})
	}
}

func TestTransitionRejectsInvalidState(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*Order)
	}{
		{"unknown status", func(o *Order) { o.Status = "unknown" }},
		{"zero version", func(o *Order) { o.Version = 0 }},
		{"negative version", func(o *Order) { o.Version = -1 }},
		{"missing ready timestamp", func(o *Order) { o.ReadyAt = nil }},
		{"unexpected completed timestamp", func(o *Order) { o.CompletedAt = o.ReadyAt }},
		{"unexpected cancelled timestamp", func(o *Order) { o.CancelledAt = o.ReadyAt }},
		{"ready before creation", func(o *Order) { at := o.CreatedAt.Add(-time.Second); o.ReadyAt = &at }},
		{"ready after update", func(o *Order) { at := o.UpdatedAt.Add(time.Second); o.ReadyAt = &at }},
		{"update before creation", func(o *Order) { o.UpdatedAt = o.CreatedAt.Add(-time.Second) }},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			o := stateOrder(OrderStatusReady)
			test.mutate(&o)
			_, err := o.Transition(OrderStatusCompleted, o.CreatedAt.Add(time.Hour))
			if !errors.Is(err, ErrInvalidState) {
				t.Fatalf("error = %v, want ErrInvalidState", err)
			}
		})
	}
	for _, status := range []OrderStatus{OrderStatusCompleted, OrderStatusCancelled} {
		o := stateOrder(status)
		at := o.ReadyAt.Add(-time.Second)
		if status == OrderStatusCompleted {
			o.CompletedAt = &at
		} else {
			o.CancelledAt = &at
		}
		if _, err := o.Transition(status, o.UpdatedAt); !errors.Is(err, ErrInvalidState) {
			t.Errorf("invalid terminal timestamp for %s: error = %v", status, err)
		}
	}
}

func TestTransitionVersionAndClock(t *testing.T) {
	o := stateOrder(OrderStatusPending)
	o.Version = math.MaxInt32
	if _, err := o.Transition(OrderStatusReady, o.CreatedAt.Add(time.Minute)); !errors.Is(err, ErrVersionOutOfRange) {
		t.Fatalf("overflow error = %v", err)
	}
	got, err := o.Transition(OrderStatusPending, time.Time{})
	if err != nil || !reflect.DeepEqual(got, o) {
		t.Fatalf("replay at max version changed order: %+v, %v", got, err)
	}
	o.Version = 1
	for _, at := range []time.Time{time.Time{}, o.CreatedAt.Add(-time.Nanosecond)} {
		if _, err := o.Transition(OrderStatusReady, at); !errors.Is(err, ErrStateConflict) {
			t.Errorf("invalid clock error = %v", err)
		}
	}
	if _, err := o.Transition("unknown", o.CreatedAt); !errors.Is(err, ErrInvalidState) {
		t.Errorf("unknown target error = %v", err)
	}
}
