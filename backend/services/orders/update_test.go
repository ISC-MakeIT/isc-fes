package orders

import (
	"context"
	"errors"
	"math"
	"reflect"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	domain "github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/services"
)

type updateResultRepository struct {
	Repository
	update func(context.Context, UpdateRepositoryInput) (UpdateResult, error)
}

func (r updateResultRepository) UpdateOrder(ctx context.Context, input UpdateRepositoryInput) (UpdateResult, error) {
	return r.update(ctx, input)
}

type recordingStatusNotifier struct{ orders []domain.Order }

func (n *recordingStatusNotifier) NotifyStatusChanged(order domain.Order) {
	n.orders = append(n.orders, order)
}

func TestUpdateOrderNotifiesOnlyCommittedChanges(t *testing.T) {
	for _, test := range []struct {
		name          string
		changed       bool
		err           error
		cancelRequest bool
		wantCalls     int
	}{
		{"changed", true, nil, false, 1},
		{"same state replay", false, nil, false, 0},
		{"commit failure", true, errors.New("commit failed"), false, 0},
		{"request cancelled after commit", true, nil, true, 1},
	} {
		t.Run(test.name, func(t *testing.T) {
			accountID := uuid.New()
			ctx, cancel := context.WithCancel(services.WithAuthenticatedAccount(t.Context(), entities.Account{ID: accountID}))
			defer cancel()
			order := domain.Order{ID: uuid.New(), StoreID: uuid.New(), GuestID: uuid.New(), Status: domain.OrderStatusReady, Version: 2}
			repo := updateResultRepository{update: func(_ context.Context, input UpdateRepositoryInput) (UpdateResult, error) {
				if input.AccountID != accountID || input.OrderID != order.ID || input.ExpectedVersion != 1 {
					t.Fatalf("unexpected update input: %+v", input)
				}
				if test.cancelRequest {
					cancel()
				}
				return UpdateResult{Order: order, Changed: test.changed}, test.err
			}}
			notifier := &recordingStatusNotifier{}
			s := NewOrderService(repo, nil, nil, nil, nil, notifier)
			got, err := s.UpdateOrder(ctx, UpdateInput{StoreID: order.StoreID, OrderID: order.ID, Status: order.Status, ExpectedVersion: 1})
			if !errors.Is(err, test.err) || len(notifier.orders) != test.wantCalls {
				t.Fatalf("error = %v, notifications = %+v", err, notifier.orders)
			}
			if err == nil && !reflect.DeepEqual(got, order) {
				t.Fatalf("update result changed: %+v", got)
			}
			if test.wantCalls == 1 && !reflect.DeepEqual(notifier.orders[0], order) {
				t.Fatalf("notification lost committed Order: %+v", notifier.orders)
			}
		})
	}
}

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
