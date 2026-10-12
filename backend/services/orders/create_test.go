package orders

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	domain "github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/services"
)

type createResultRepository struct {
	Repository
	create func(context.Context, CreateRepositoryInput) (CreateResult, error)
}

func (r createResultRepository) CreateOrder(ctx context.Context, input CreateRepositoryInput) (CreateResult, error) {
	return r.create(ctx, input)
}

type anonymousOrderAccountLoader struct{}

func (anonymousOrderAccountLoader) GetCurrentAccount(context.Context) (entities.Account, error) {
	return entities.Account{}, services.ErrUnauthenticated
}

func TestCreateOrderNotifiesOnlyCommittedNewOrders(t *testing.T) {
	for _, test := range []struct {
		name          string
		replayed      bool
		err           error
		cancelRequest bool
		nilNotifier   bool
		wantCalls     int
	}{
		{name: "new order", wantCalls: 1},
		{name: "same cart version replay", replayed: true},
		{name: "commit failure", err: errors.New("commit failed")},
		{name: "request cancelled after commit", cancelRequest: true, wantCalls: 1},
		{name: "without notifier", nilNotifier: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			order := domain.Order{ID: uuid.New(), StoreID: uuid.New(), GuestID: uuid.New(), Status: domain.OrderStatusPending, Version: 1}
			ctx, cancel := context.WithCancel(services.WithGuest(t.Context(), order.GuestID))
			defer cancel()
			repo := createResultRepository{create: func(_ context.Context, input CreateRepositoryInput) (CreateResult, error) {
				if input.GuestID != order.GuestID || input.StoreID != order.StoreID || input.ExpectedCartVersion != 1 || input.AccountID != nil {
					t.Fatalf("unexpected create input: %+v", input)
				}
				if test.cancelRequest {
					cancel()
				}
				return CreateResult{Order: order, Replayed: test.replayed}, test.err
			}}
			notifier := &recordingStatusNotifier{}
			var configuredNotifier OrderStatusNotifier = notifier
			if test.nilNotifier {
				configuredNotifier = nil
			}
			s := NewOrderService(repo, anonymousOrderAccountLoader{}, nil, nil, nil, configuredNotifier)
			got, err := s.CreateOrder(ctx, CreateInput{StoreID: order.StoreID, ExpectedCartVersion: 1})
			if !errors.Is(err, test.err) || len(notifier.orders) != test.wantCalls {
				t.Fatalf("error = %v, notifications = %+v", err, notifier.orders)
			}
			if err == nil && !reflect.DeepEqual(got, CreateResult{Order: order, Replayed: test.replayed}) {
				t.Fatalf("create result changed: %+v", got)
			}
			if test.wantCalls == 1 && !reflect.DeepEqual(notifier.orders[0], order) {
				t.Fatalf("notification lost committed Order: %+v", notifier.orders)
			}
		})
	}
}
