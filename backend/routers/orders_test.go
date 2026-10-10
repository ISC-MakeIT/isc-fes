package routers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	domain "github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/services"
	orderservice "github.com/isc-makeit/isc-fes/backend/services/orders"
)

type stubOrderUpdateRepository struct {
	orderservice.Repository
	input orderservice.UpdateRepositoryInput
	order domain.Order
	err   error
	calls int
}

func (r *stubOrderUpdateRepository) UpdateOrder(_ context.Context, input orderservice.UpdateRepositoryInput) (domain.Order, error) {
	r.calls++
	r.input = input
	return r.order, r.err
}

func TestUpdateOrderEndpoint(t *testing.T) {
	gin.SetMode(gin.TestMode)
	storeID, orderID, accountID := uuid.New(), uuid.New(), uuid.New()
	ready := time.Now().UTC().Truncate(time.Microsecond)
	for _, test := range []struct {
		name    string
		body    string
		authErr error
		repoErr error
		status  int
		calls   int
	}{
		{"success", `{"status":"ready","expectedVersion":1}`, nil, nil, 200, 1},
		{"version conflict", `{"status":"ready","expectedVersion":1}`, nil, orderservice.ErrOrderVersionConflict, 409, 1},
		{"state conflict", `{"status":"ready","expectedVersion":1}`, nil, orderservice.ErrOrderStateConflict, 409, 1},
		{"too early", `{"status":"cancelled","expectedVersion":2}`, nil, orderservice.ErrCancelTooEarly, 409, 1},
		{"forbidden", `{"status":"ready","expectedVersion":1}`, nil, services.ErrForbidden, 403, 1},
		{"not found", `{"status":"ready","expectedVersion":1}`, nil, services.ErrNotFound, 404, 1},
		{"internal error", `{"status":"ready","expectedVersion":1}`, nil, errors.New("database unavailable"), 500, 1},
		{"unauthenticated", `{"status":"ready","expectedVersion":1}`, services.ErrUnauthenticated, nil, 401, 0},
		{"unknown status", `{"status":"invalid","expectedVersion":1}`, nil, nil, 400, 0},
		{"zero version", `{"status":"ready","expectedVersion":0}`, nil, nil, 400, 0},
		{"missing version", `{"status":"ready"}`, nil, nil, 400, 0},
		{"missing status", `{"expectedVersion":1}`, nil, nil, 400, 0},
		{"extra field", `{"status":"ready","expectedVersion":1,"totalAmount":0}`, nil, nil, 400, 0},
		{"malformed json", `{`, nil, nil, 400, 0},
	} {
		t.Run(test.name, func(t *testing.T) {
			repo := &stubOrderUpdateRepository{err: test.repoErr, order: domain.Order{
				ID: orderID, StoreID: storeID, Status: domain.OrderStatusReady, Version: 2,
				ReadyAt: &ready, UpdatedAt: ready, Items: []domain.OrderItem{},
			}}
			s := &Server{
				accountService: &stubCurrentAccountLoader{account: entities.Account{ID: accountID}, err: test.authErr},
				orders:         orderservice.NewOrderService(repo, nil, nil, nil, nil),
			}
			router, err := NewRouter(s, []string{"http://localhost:3000"})
			if err != nil {
				t.Fatal(err)
			}
			request := httptest.NewRequest(http.MethodPatch, "/stores/"+storeID.String()+"/orders/"+orderID.String(), strings.NewReader(test.body))
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != test.status {
				t.Fatalf("status = %d, want %d: %s", response.Code, test.status, response.Body)
			}
			if repo.calls != test.calls {
				t.Fatalf("repository calls = %d, want %d", repo.calls, test.calls)
			}
			if test.calls > 0 && (repo.input.AccountID != accountID || repo.input.StoreID != storeID || repo.input.OrderID != orderID) {
				t.Fatalf("wrong identity: %+v", repo.input)
			}
			if response.Code == http.StatusOK {
				var order Order
				if err := json.Unmarshal(response.Body.Bytes(), &order); err != nil {
					t.Fatal(err)
				}
				if order.Id != orderID || order.Version != 2 || order.Status != OrderStatusReady || order.ReadyAt == nil || !order.ReadyAt.Equal(ready) {
					t.Fatalf("unexpected response: %+v", order)
				}
			}
		})
	}
}
