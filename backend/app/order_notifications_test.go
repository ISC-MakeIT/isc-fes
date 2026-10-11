package app

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/google/uuid"
	domain "github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/routers"
)

func (f *ordersWebSocketFixture) signInAccount(t *testing.T, storeID uuid.UUID) *http.Client {
	t.Helper()
	id := uuid.New()
	if _, err := f.pool.Exec(t.Context(), `INSERT INTO accounts (id,google_sub,email) VALUES ($1,$2,'staff@example.com')`, id, id.String()); err != nil {
		t.Fatal(err)
	}
	if storeID != uuid.Nil {
		if _, err := f.pool.Exec(t.Context(), `INSERT INTO store_members (store_id,account_id,role) VALUES ($1,$2,'staff')`, storeID, id); err != nil {
			t.Fatal(err)
		}
	}
	client := newWebSocketClient(t)
	response, err := client.Post(f.server.URL+"/test/signin/"+id.String(), "application/json", nil)
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusNoContent {
		t.Fatalf("signin status = %d", response.StatusCode)
	}
	return client
}

func TestOrderNotificationsReloadLatestStateEvenWhenPublishedOutOfOrder(t *testing.T) {
	f := newOrdersWebSocketFixture(t)
	client, otherClient := newWebSocketClient(t), newWebSocketClient(t)
	for _, c := range []*http.Client{client, otherClient} {
		conn := f.dial(t, c)
		conn.CloseNow()
		f.waitFinished(t)
	}
	guestID, otherID := uuid.MustParse(f.guestID(t, client)), uuid.MustParse(f.guestID(t, otherClient))
	expected := f.seedOrders(t, guestID, otherID)
	conn, _ := f.dialReady(t, client)
	var orderID, storeID uuid.UUID
	for id, status := range expected {
		if status == "pending" {
			orderID = id
		}
	}
	if err := f.pool.QueryRow(t.Context(), `SELECT store_id FROM orders WHERE id=$1`, orderID).Scan(&storeID); err != nil {
		t.Fatal(err)
	}
	// 新しい更新が既にコミット済みなのに、古い更新の通知が遅れて到着する。
	if _, err := f.pool.Exec(t.Context(), `UPDATE orders SET status='completed',version=version+1,
		ready_at=coalesce(ready_at,clock_timestamp()),completed_at=clock_timestamp(),updated_at=clock_timestamp()
		WHERE guest_id=$1 AND status IN ('pending','ready')`, guestID); err != nil {
		t.Fatal(err)
	}
	notifier := routers.NewOrderStatusNotifier(f.hub)
	notifier.NotifyStatusChanged(domain.Order{ID: orderID, StoreID: storeID, GuestID: guestID, Status: domain.OrderStatusCompleted, Version: 3})
	notifier.NotifyStatusChanged(domain.Order{ID: orderID, StoreID: storeID, GuestID: guestID, Status: domain.OrderStatusReady, Version: 2})
	for range 2 {
		message := readOrderSocket(t, conn)
		var event struct {
			Type string `json:"type"`
			Data struct {
				Orders         []routers.Order `json:"orders"`
				ChangedOrderID uuid.UUID       `json:"changedOrderId"`
			} `json:"data"`
		}
		if err := json.Unmarshal(message, &event); err != nil {
			t.Fatal(err)
		}
		if event.Type != "orders.changed" || event.Data.Orders == nil || len(event.Data.Orders) != 0 || event.Data.ChangedOrderID != orderID {
			t.Fatalf("delayed notification resurrected inactive orders: %s", message)
		}
	}
}

func TestOrderChangedSnapshotFailureClosesWithoutEmptyReplacement(t *testing.T) {
	for _, scenario := range []string{"query failure", "encoding failure"} {
		t.Run(scenario, func(t *testing.T) {
			f := newOrdersWebSocketFixture(t)
			client, otherClient := newWebSocketClient(t), newWebSocketClient(t)
			for _, c := range []*http.Client{client, otherClient} {
				conn := f.dial(t, c)
				conn.CloseNow()
				f.waitFinished(t)
			}
			guestID, otherID := uuid.MustParse(f.guestID(t, client)), uuid.MustParse(f.guestID(t, otherClient))
			f.seedOrders(t, guestID, otherID)
			conn, _ := f.dialReady(t, client)
			if scenario == "query failure" {
				if _, err := f.pool.Exec(t.Context(), `ALTER TABLE orders RENAME TO unavailable_orders`); err != nil {
					t.Fatal(err)
				}
			} else {
				if _, err := f.pool.Exec(t.Context(), `UPDATE orders SET updated_at='10000-01-01' WHERE guest_id=$1`, guestID); err != nil {
					t.Fatal(err)
				}
			}
			if err := f.hub.Publish(guestID, uuid.New()); err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
			defer cancel()
			_, message, err := conn.Read(ctx)
			if websocket.CloseStatus(err) != websocket.StatusInternalError {
				t.Fatalf("snapshot failure sent %s, error=%v; want close 1011", message, err)
			}
			f.waitFinished(t)
		})
	}
}

func readOrderSocket(t *testing.T, conn *websocket.Conn) []byte {
	t.Helper()
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	messageType, message, err := conn.Read(ctx)
	if err != nil || messageType != websocket.MessageText {
		t.Fatalf("WS read = %s, %v, %v", message, messageType, err)
	}
	return message
}

func TestOrderStatusNotificationsThroughAuthenticatedHTTP(t *testing.T) {
	f := newOrdersWebSocketFixture(t)
	client, otherClient := newWebSocketClient(t), newWebSocketClient(t)
	for _, c := range []*http.Client{client, otherClient} {
		conn := f.dial(t, c)
		conn.CloseNow()
		f.waitFinished(t)
	}
	guestID, otherID := uuid.MustParse(f.guestID(t, client)), uuid.MustParse(f.guestID(t, otherClient))
	expected := f.seedOrders(t, guestID, otherID)
	var orderID, storeID uuid.UUID
	for id, status := range expected {
		if status == "pending" {
			orderID = id
		}
	}
	if err := f.pool.QueryRow(t.Context(), `SELECT store_id FROM orders WHERE id=$1`, orderID).Scan(&storeID); err != nil {
		t.Fatal(err)
	}
	staff, outsider := f.signInAccount(t, storeID), f.signInAccount(t, uuid.Nil)
	first, _ := f.dialReady(t, client)
	second, _ := f.dialReady(t, client)
	other, _ := f.dialReady(t, otherClient)

	patch := func(c *http.Client, id uuid.UUID, status string, version int, wantStatus int) routers.Order {
		t.Helper()
		body := fmt.Sprintf(`{"status":%q,"expectedVersion":%d}`, status, version)
		request, err := http.NewRequestWithContext(t.Context(), http.MethodPatch,
			f.server.URL+"/stores/"+storeID.String()+"/orders/"+id.String(), strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		request.Header.Set("Content-Type", "application/json")
		response, err := c.Do(request)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		payload, err := io.ReadAll(response.Body)
		if err != nil {
			t.Fatal(err)
		}
		if response.StatusCode != wantStatus {
			t.Fatalf("PATCH status = %d, want %d: %s", response.StatusCode, wantStatus, payload)
		}
		var order routers.Order
		if wantStatus == http.StatusOK {
			if err := json.Unmarshal(payload, &order); err != nil {
				t.Fatal(err)
			}
		}
		return order
	}
	assertEvent := func(want routers.Order) {
		t.Helper()
		// イベントに載るversionは、別のDB接続から既に読めるコミット済みの値。
		var storedVersion int32
		if err := f.pool.QueryRow(t.Context(), `SELECT version FROM orders WHERE id=$1`, want.Id).Scan(&storedVersion); err != nil {
			t.Fatal(err)
		}
		if storedVersion != want.Version {
			t.Fatalf("DB version = %d, event version = %d", storedVersion, want.Version)
		}
		response, err := client.Get(f.server.URL + "/orders?statuses=pending&statuses=ready")
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		if response.StatusCode != http.StatusOK {
			t.Fatalf("REST orders status = %d", response.StatusCode)
		}
		var rest routers.GetOrdersResponse
		if err := json.NewDecoder(response.Body).Decode(&rest); err != nil {
			t.Fatal(err)
		}
		for _, conn := range []*websocket.Conn{first, second} {
			message := readOrderSocket(t, conn)
			var event struct {
				Type string `json:"type"`
				Data struct {
					Orders         []routers.Order `json:"orders"`
					ChangedOrderID uuid.UUID       `json:"changedOrderId"`
				} `json:"data"`
			}
			if err := json.Unmarshal(message, &event); err != nil {
				t.Fatal(err)
			}
			if event.Type != "orders.changed" || event.Data.ChangedOrderID != orderID || !reflect.DeepEqual(event.Data.Orders, rest.Data) {
				t.Fatalf("WS active orders differ from REST: %s; REST=%+v", message, rest)
			}
			for _, order := range event.Data.Orders {
				if order.Status != "pending" && order.Status != "ready" {
					t.Fatalf("inactive order sent: %+v", order)
				}
			}
			var envelope struct {
				Data struct {
					Orders []map[string]json.RawMessage `json:"orders"`
				} `json:"data"`
			}
			if err := json.Unmarshal(message, &envelope); err != nil {
				t.Fatal(err)
			}
			for _, order := range envelope.Data.Orders {
				for _, key := range []string{"guestId", "originCartId", "originCartVersion", "limitExemptedByAccountId"} {
					if _, found := order[key]; found {
						t.Fatalf("event exposed %s", key)
					}
				}
			}
		}
	}
	// HTTP応答前にenqueueされる契約なので、応答後のmarkerより前に余計な通知がないことを確認できる。
	// ReadのタイムアウトでWSを切断せず、別Guestへの漏れ・再送や失敗時の通知を検出する。
	assertNoEvents := func() {
		t.Helper()
		marker := uuid.New()
		for _, id := range []uuid.UUID{guestID, otherID} {
			if err := f.hub.Publish(id, marker); err != nil {
				t.Fatal(err)
			}
		}
		for _, conn := range []*websocket.Conn{first, second, other} {
			message := readOrderSocket(t, conn)
			var event struct {
				Data struct {
					ChangedOrderID uuid.UUID `json:"changedOrderId"`
				} `json:"data"`
			}
			if err := json.Unmarshal(message, &event); err != nil {
				t.Fatal(err)
			}
			if event.Data.ChangedOrderID != marker {
				t.Fatalf("unexpected status notification: %s", message)
			}
		}
	}

	ready := patch(staff, orderID, "ready", 1, http.StatusOK)
	if ready.Status != routers.OrderStatus("ready") || ready.Version != 2 || ready.ReadyAt == nil || ready.TotalAmount != 600 ||
		len(ready.Items) != 1 || ready.Items[0].MenuName != "snapshot menu" || ready.Items[0].UnitPrice != 250 ||
		len(ready.Items[0].Toppings) != 1 || ready.Items[0].Toppings[0].UnitPrice != 50 {
		t.Fatalf("invalid ready snapshot: %+v", ready)
	}
	assertEvent(ready)
	assertNoEvents()
	if replay := patch(staff, orderID, "ready", 1, http.StatusOK); !reflect.DeepEqual(replay, ready) {
		t.Fatalf("replay changed Order: %+v", replay)
	}
	patch(outsider, orderID, "completed", 2, http.StatusForbidden)
	patch(newWebSocketClient(t), orderID, "completed", 2, http.StatusUnauthorized)
	patch(staff, orderID, "completed", 1, http.StatusConflict)
	patch(staff, orderID, "pending", 2, http.StatusConflict)
	assertNoEvents()

	// SQL更新が成功しても、コミット時の遅延制約が失敗したら通知しない。
	if _, err := f.pool.Exec(t.Context(), `CREATE FUNCTION reject_order_commit() RETURNS trigger LANGUAGE plpgsql AS $$
		BEGIN RAISE EXCEPTION 'test commit failure'; END $$;
		CREATE CONSTRAINT TRIGGER reject_order_commit AFTER UPDATE ON orders
		DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION reject_order_commit()`); err != nil {
		t.Fatal(err)
	}
	patch(staff, orderID, "completed", 2, http.StatusInternalServerError)
	assertNoEvents()
	if _, err := f.pool.Exec(t.Context(), `DROP TRIGGER reject_order_commit ON orders`); err != nil {
		t.Fatal(err)
	}
	completed := patch(staff, orderID, "completed", 2, http.StatusOK)
	if completed.Version != 3 || completed.CompletedAt == nil {
		t.Fatalf("invalid completed Order: %+v", completed)
	}
	assertEvent(completed)
	assertNoEvents()

	// Hubが停止しても、確定済みの注文更新をHTTPエラーへ変えない。
	f.hub.Stop()
	for _, conn := range []*websocket.Conn{first, second, other} {
		ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
		_, _, err := conn.Read(ctx)
		cancel()
		if websocket.CloseStatus(err) != websocket.StatusGoingAway {
			t.Fatalf("stop close = %v", err)
		}
		f.waitFinished(t)
	}
	var otherOrderID uuid.UUID
	if err := f.pool.QueryRow(t.Context(), `SELECT id FROM orders WHERE guest_id=$1`, otherID).Scan(&otherOrderID); err != nil {
		t.Fatal(err)
	}
	if result := patch(staff, otherOrderID, "completed", 2, http.StatusOK); result.Version != 3 {
		t.Fatalf("stopped Hub changed update result: %+v", result)
	}
}
