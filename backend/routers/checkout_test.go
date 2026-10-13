package routers

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/services"
	orderservice "github.com/isc-makeit/isc-fes/backend/services/orders"
)

type stubCheckoutRepository struct {
	orderservice.Repository
	input orderservice.CreateRepositoryInput
	err   error
	calls int
}

func (r *stubCheckoutRepository) CheckCheckout(_ context.Context, input orderservice.CreateRepositoryInput) error {
	r.input = input
	r.calls++
	return r.err
}

// ResolveOrCreateGuestの呼び出しは既存stubのcallsに記録される。
type checkoutGuestResolver struct {
	stubGuestResolver
	found bool
}

func (r *checkoutGuestResolver) ResolveGuest(context.Context) (uuid.UUID, bool, error) {
	return r.guestID, r.found, r.err
}

func TestCheckoutEndpoint(t *testing.T) {
	gin.SetMode(gin.TestMode)
	swagger, err := GetSwagger()
	if err != nil {
		t.Fatal(err)
	}
	storeID, guestID, accountID := uuid.New(), uuid.New(), uuid.New()
	for _, test := range []struct {
		name    string
		query   string
		err     error
		status  int
		code    string
		noGuest bool
	}{
		{name: "checkoutable", query: "?expectedCartVersion=3", status: 200},
		{name: "closed", query: "?expectedCartVersion=3", err: orderservice.ErrStoreClosed, status: 200, code: "store_closed"},
		{name: "disabled", query: "?expectedCartVersion=3", err: orderservice.ErrStoreOrderDisabled, status: 200, code: "store_order_disabled"},
		{name: "stale cart", query: "?expectedCartVersion=3", err: orderservice.ErrCartVersionConflict, status: 200, code: "cart_version_conflict"},
		{name: "empty", query: "?expectedCartVersion=3", err: orderservice.ErrCartEmpty, status: 200, code: "cart_empty"},
		{name: "unavailable", query: "?expectedCartVersion=3", err: orderservice.ErrUnavailableItems, status: 200, code: "cart_items_unavailable"},
		{name: "invalid cart", query: "?expectedCartVersion=3", err: orderservice.ErrInvalidCart, status: 200, code: "invalid_cart"},
		{name: "limit", query: "?expectedCartVersion=3", err: orderservice.ErrOrderLimitReached, status: 200, code: "order_limit_reached"},
		{name: "missing guest", query: "?expectedCartVersion=3", err: orderservice.ErrCartEmpty, status: 200, code: "cart_empty", noGuest: true},
		{name: "missing store", query: "?expectedCartVersion=3", err: services.ErrNotFound, status: 404},
		{name: "internal failure", query: "?expectedCartVersion=3", err: errors.New("database unavailable"), status: 500},
		{name: "missing version", status: 400},
		{name: "zero version", query: "?expectedCartVersion=0", status: 400},
	} {
		t.Run(test.name, func(t *testing.T) {
			repo := &stubCheckoutRepository{err: test.err}
			guest := &checkoutGuestResolver{stubGuestResolver: stubGuestResolver{guestID: guestID}, found: !test.noGuest}
			account := &stubCurrentAccountLoader{err: services.ErrUnauthenticated}
			if !test.noGuest {
				account.account.ID, account.err = accountID, nil
			}
			s := &Server{guestResolver: guest, orders: orderservice.NewOrderService(repo, account, guest, nil, nil, nil)}
			router, err := NewRouter(s, []string{"http://localhost:3000"})
			if err != nil {
				t.Fatal(err)
			}
			response := httptest.NewRecorder()
			router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/stores/"+storeID.String()+"/carts/checkoutable"+test.query, nil))
			if response.Code != test.status {
				t.Fatalf("status = %d, want %d: %s", response.Code, test.status, response.Body)
			}
			if guest.calls != 0 {
				t.Fatal("GET created a guest")
			}
			if test.status == 400 {
				if repo.calls != 0 {
					t.Fatal("invalid request reached repository")
				}
				return
			}
			if repo.calls != 1 || repo.input.StoreID != storeID || repo.input.ExpectedCartVersion != 3 {
				t.Fatalf("unexpected input: %+v", repo.input)
			}
			if test.noGuest {
				if repo.input.GuestID != uuid.Nil || repo.input.AccountID != nil {
					t.Fatalf("unexpected anonymous identity: %+v", repo.input)
				}
			} else if repo.input.GuestID != guestID || repo.input.AccountID == nil || *repo.input.AccountID != accountID {
				t.Fatalf("session identity lost: %+v", repo.input)
			}
			if response.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("checkout response is cacheable")
			}
			if test.status == 200 {
				var body map[string]any
				if err := json.Unmarshal(response.Body.Bytes(), &body); err != nil {
					t.Fatal(err)
				}
				want := any(nil)
				if test.code != "" {
					want = test.code
				}
				code, present := body["code"]
				if len(body) != 1 || !present || code != want {
					t.Fatalf("response = %s", response.Body)
				}
				if err := swagger.Components.Schemas["CheckoutCheckResponse"].Value.VisitJSON(body); err != nil {
					t.Fatalf("response does not match OpenAPI: %v", err)
				}
			}
		})
	}
}
