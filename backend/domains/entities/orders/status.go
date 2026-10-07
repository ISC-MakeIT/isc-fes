package orders

import (
	"errors"
	"math"
	"time"
)

type OrderStatus string

const (
	OrderStatusPending   OrderStatus = "pending"
	OrderStatusReady     OrderStatus = "ready"
	OrderStatusCompleted OrderStatus = "completed"
	OrderStatusCancelled OrderStatus = "cancelled"

	CancellationDelay = 15 * time.Minute
)

var (
	ErrInvalidState      = errors.New("invalid order state")
	ErrStateConflict     = errors.New("order state conflict")
	ErrCancelTooEarly    = errors.New("order cancellation too early")
	ErrVersionOutOfRange = errors.New("order version out of range")
)

func (s OrderStatus) IsValid() bool {
	switch s {
	case OrderStatusPending, OrderStatusReady, OrderStatusCompleted, OrderStatusCancelled:
		return true
	default:
		return false
	}
}

// Transition は変更後の注文を返し、元の注文は変更しない。
// at には後続の状態更新処理で、Order行のロック後に取得したDB時刻を渡す。
// 同じ状態への再送はversion・時刻を含めて変更しない。
func (o Order) Transition(next OrderStatus, at time.Time) (Order, error) {
	if !next.IsValid() || !o.validState() {
		return Order{}, ErrInvalidState
	}
	if o.Status == next {
		return o, nil
	}

	switch {
	case o.Status == OrderStatusPending && next == OrderStatusReady:
	case o.Status == OrderStatusReady && next == OrderStatusCompleted:
	case o.Status == OrderStatusReady && next == OrderStatusCancelled:
		if at.Before(o.ReadyAt.Add(CancellationDelay)) {
			return Order{}, ErrCancelTooEarly
		}
	default:
		return Order{}, ErrStateConflict
	}

	if at.IsZero() || at.Before(o.UpdatedAt) {
		return Order{}, ErrStateConflict
	}
	if o.Version == math.MaxInt32 {
		return Order{}, ErrVersionOutOfRange
	}
	o.Status = next
	o.Version++
	o.UpdatedAt = at
	switch next {
	case OrderStatusReady:
		o.ReadyAt = &at
	case OrderStatusCompleted:
		o.CompletedAt = &at
	case OrderStatusCancelled:
		o.CancelledAt = &at
	}
	return o, nil
}

func (o Order) validState() bool {
	if o.Version <= 0 || o.UpdatedAt.Before(o.CreatedAt) {
		return false
	}
	if o.ReadyAt != nil && (o.ReadyAt.Before(o.CreatedAt) || o.ReadyAt.After(o.UpdatedAt)) {
		return false
	}
	switch o.Status {
	case OrderStatusPending:
		return o.ReadyAt == nil && o.CompletedAt == nil && o.CancelledAt == nil
	case OrderStatusReady:
		return o.ReadyAt != nil && o.CompletedAt == nil && o.CancelledAt == nil
	case OrderStatusCompleted:
		return o.ReadyAt != nil && o.CompletedAt != nil && o.CancelledAt == nil &&
			!o.CompletedAt.Before(*o.ReadyAt) && !o.CompletedAt.After(o.UpdatedAt)
	case OrderStatusCancelled:
		return o.ReadyAt != nil && o.CompletedAt == nil && o.CancelledAt != nil &&
			!o.CancelledAt.Before(*o.ReadyAt) && !o.CancelledAt.After(o.UpdatedAt)
	default:
		return false
	}
}
