package routers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"slices"
	"testing"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	domain "github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/services"
	orderservice "github.com/isc-makeit/isc-fes/backend/services/orders"
	"github.com/jackc/pgx/v5"
)

type stubPublicOrderRepository struct {
	orderservice.Repository
	orders   []domain.Order
	err      error
	storeID  uuid.UUID
	statuses []domain.OrderStatus
	calls    int
}

func (r *stubPublicOrderRepository) GetOrdersByStoreID(_ context.Context, storeID uuid.UUID, statuses []domain.OrderStatus) ([]domain.Order, error) {
	r.storeID = storeID
	r.statuses = statuses
	r.calls++
	return r.orders, r.err
}

type stubPublicOrderStoreRepository struct {
	err error
}

func (r stubPublicOrderStoreRepository) GetStoreByID(_ context.Context, storeID uuid.UUID) (entities.Store, error) {
	return entities.Store{ID: storeID}, r.err
}

func TestPublicOrdersEndpoint(t *testing.T) {
	storeID := uuid.New()
	path := "/stores/" + storeID.String() + "/orders/public"
	for _, test := range []struct {
		name      string
		path      string
		storeErr  error
		repoErr   error
		empty     bool
		status    int
		repoCalls int
	}{
		{name: "anonymous", path: path, status: http.StatusOK, repoCalls: 1},
		{name: "statuses cannot change public selection", path: path + "?statuses=completed&statuses=cancelled", status: http.StatusOK, repoCalls: 1},
		{name: "empty", path: path, empty: true, status: http.StatusOK, repoCalls: 1},
		{name: "missing store", path: path, storeErr: pgx.ErrNoRows, status: http.StatusNotFound},
		{name: "store failure", path: path, storeErr: errors.New("database unavailable"), status: http.StatusInternalServerError},
		{name: "order failure", path: path, repoErr: errors.New("database unavailable"), status: http.StatusInternalServerError, repoCalls: 1},
		{name: "invalid store ID", path: "/stores/invalid/orders/public", status: http.StatusBadRequest},
		{name: "nil store ID", path: "/stores/" + uuid.Nil.String() + "/orders/public", status: http.StatusBadRequest},
	} {
		t.Run(test.name, func(t *testing.T) {
			repo := &stubPublicOrderRepository{err: test.repoErr}
			if !test.empty {
				repo.orders = []domain.Order{
					{
						ID: uuid.New(), StoreID: storeID, GuestID: uuid.New(), DisplayNumber: 1,
						Status: domain.OrderStatusPending, TotalAmount: 500,
						Items: []domain.OrderItem{{MenuName: "menu", UnitPrice: 250, Quantity: 2}},
					},
					{DisplayNumber: 2, Status: domain.OrderStatusReady},
				}
			}
			accountLoader := &stubCurrentAccountLoader{err: services.ErrUnauthenticated}
			guestResolver := &stubGuestResolver{}
			s := &Server{
				accountService: accountLoader,
				guestResolver:  guestResolver,
				orders: orderservice.NewOrderService(repo, nil, nil,
					stubPublicOrderStoreRepository{err: test.storeErr}, nil, nil),
			}
			router, err := NewRouter(s, []string{"https://frontend.example.com"})
			if err != nil {
				t.Fatal(err)
			}
			request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, test.path, nil)
			request.Header.Set("Origin", "https://third-party.example.com")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)

			if response.Code != test.status {
				t.Fatalf("status = %d, want %d: %s", response.Code, test.status, response.Body)
			}
			if repo.calls != test.repoCalls || (repo.calls > 0 && repo.storeID != storeID) {
				t.Errorf("repository calls = %d, store = %s", repo.calls, repo.storeID)
			}
			if repo.calls > 0 && !slices.Equal(repo.statuses, []domain.OrderStatus{domain.OrderStatusPending, domain.OrderStatusReady}) {
				t.Errorf("repository statuses = %v, want pending/ready", repo.statuses)
			}
			if accountLoader.calls != 0 || guestResolver.calls != 0 || len(response.Result().Cookies()) != 0 {
				t.Error("public endpoint accessed or issued a session")
			}
			if got := response.Header().Get("Access-Control-Allow-Origin"); got != "*" {
				t.Errorf("Access-Control-Allow-Origin = %q, want *", got)
			}
			if got := response.Header().Get("Access-Control-Allow-Credentials"); got != "" {
				t.Errorf("Access-Control-Allow-Credentials = %q, want empty", got)
			}
			if test.status == http.StatusOK {
				var body GetOrdersResponse
				if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
					t.Fatal(err)
				}
				if body.Total != len(repo.orders) || len(body.Data) != len(repo.orders) || body.Data == nil {
					t.Fatalf("unexpected order list: %s", response.Body)
				}
				if !test.empty {
					order := body.Data[0]
					if order.Id != repo.orders[0].ID || order.StoreId != storeID || order.TotalAmount != 500 || order.Status != OrderStatusPending || order.DisplayNumber != 1 || body.Data[1].Status != OrderStatusReady {
						t.Errorf("unexpected order: %+v", order)
					}
					if len(order.Items) != 1 || order.Items[0].MenuName != "menu" || order.Items[0].UnitPrice != 250 || order.Items[0].Quantity != 2 {
						t.Errorf("unexpected order items: %+v", order.Items)
					}
				}
			}
		})
	}
}

func TestPublicOrdersCORSIsScoped(t *testing.T) {
	storePath := "/stores/" + uuid.NewString()
	for _, test := range []struct {
		name   string
		method string
		path   string
		status int
	}{
		{"public GET", http.MethodGet, storePath + "/orders/public", http.StatusNoContent},
		{"public POST", http.MethodPost, storePath + "/orders/public", http.StatusForbidden},
		{"public PATCH", http.MethodPatch, storePath + "/orders/public", http.StatusForbidden},
		{"private orders", http.MethodGet, storePath + "/orders", http.StatusForbidden},
		{"update order", http.MethodPatch, storePath + "/orders/" + uuid.NewString(), http.StatusForbidden},
		{"other endpoint", http.MethodGet, "/health", http.StatusForbidden},
	} {
		t.Run(test.name, func(t *testing.T) {
			router, err := NewRouter(&Server{}, []string{"https://frontend.example.com"})
			if err != nil {
				t.Fatal(err)
			}
			request := httptest.NewRequestWithContext(t.Context(), http.MethodOptions, test.path, nil)
			request.Header.Set("Origin", "https://third-party.example.com")
			request.Header.Set("Access-Control-Request-Method", test.method)
			request.Header.Set("Access-Control-Request-Headers", "sentry-trace,baggage")
			response := httptest.NewRecorder()
			router.ServeHTTP(response, request)
			if response.Code != test.status {
				t.Fatalf("status = %d, want %d", response.Code, test.status)
			}
			if test.status == http.StatusNoContent {
				if got := response.Header().Get("Access-Control-Allow-Origin"); got != "*" {
					t.Errorf("Access-Control-Allow-Origin = %q, want *", got)
				}
				if got := response.Header().Get("Access-Control-Allow-Credentials"); got != "" {
					t.Errorf("Access-Control-Allow-Credentials = %q, want empty", got)
				}
				if got := response.Header().Get("Access-Control-Allow-Methods"); got != "GET,OPTIONS" {
					t.Errorf("Access-Control-Allow-Methods = %q, want GET,OPTIONS", got)
				}
			} else if got := response.Header().Get("Access-Control-Allow-Origin"); got != "" {
				t.Errorf("Access-Control-Allow-Origin = %q, want empty", got)
			}
		})
	}
}

func TestPrivateStoreOrdersStillRequireAuthentication(t *testing.T) {
	accountLoader := &stubCurrentAccountLoader{err: services.ErrUnauthenticated}
	router, err := NewRouter(&Server{accountService: accountLoader}, []string{"https://frontend.example.com"})
	if err != nil {
		t.Fatal(err)
	}
	request := httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/stores/"+uuid.NewString()+"/orders", nil)
	response := httptest.NewRecorder()
	router.ServeHTTP(response, request)
	if response.Code != http.StatusUnauthorized || accountLoader.calls != 1 {
		t.Fatalf("status = %d, authentication calls = %d", response.Code, accountLoader.calls)
	}
}
