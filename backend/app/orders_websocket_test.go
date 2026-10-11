package app

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/alexedwards/scs/pgxstore"
	"github.com/alexedwards/scs/v2"
	"github.com/coder/websocket"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/auth"
	db "github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/realtime"
	"github.com/isc-makeit/isc-fes/backend/repositories"
	orders_repository "github.com/isc-makeit/isc-fes/backend/repositories/orders"
	"github.com/isc-makeit/isc-fes/backend/routers"
	"github.com/isc-makeit/isc-fes/backend/services"
	orders_service "github.com/isc-makeit/isc-fes/backend/services/orders"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

const wsTestOrigin = "https://frontend.example.com"

type ordersWebSocketFixture struct {
	pool     *pgxpool.Pool
	server   *httptest.Server
	finished chan struct{}
	hub      *realtime.Hub
}

// 本番のGin・二重scsミドルウェア・GuestService・pgxstoreを実接続で確認する。
// 初期一覧には本番のOrderService・RepositoryとREST変換を使用する。
func newOrdersWebSocketFixture(t *testing.T) *ordersWebSocketFixture {
	t.Helper()
	dsn := os.Getenv("TEST_ORDER_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_ORDER_DATABASE_URL is required for PostgreSQL integration tests")
	}
	ctx, cancel := context.WithTimeout(t.Context(), 20*time.Second)
	defer cancel()
	admin, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { admin.Close(context.Background()) })
	schema := pgx.Identifier{"ws_orders_" + uuid.New().String()}.Sanitize()
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := admin.Exec(context.Background(), "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Error(err)
		}
	})
	if _, err := admin.Exec(ctx, "SET search_path TO "+schema); err != nil {
		t.Fatal(err)
	}
	migrations, err := filepath.Glob("../db/migrations/*.up.sql")
	if err != nil || len(migrations) == 0 {
		t.Fatalf("find migrations: %v", err)
	}
	for _, path := range migrations {
		migration, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := admin.Exec(ctx, string(migration)); err != nil {
			t.Fatalf("%s: %v", path, err)
		}
	}
	config, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		t.Fatal(err)
	}
	config.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	account, stopAccount := auth.NewAccountSession(pool, false, "")
	guest, stopGuest := auth.NewGuestSession(pool, false, "")
	t.Cleanup(stopAccount)
	t.Cleanup(stopGuest)
	resolver := services.NewGuestService(guest, repositories.NewGuestRepository(db.New(pool)))
	orderService := orders_service.NewOrderService(orders_repository.NewOrderRepository(db.New(pool), pool), nil, resolver, nil, nil)
	hub := realtime.NewHub()
	s := routers.NewServer(nil, nil, "", nil, nil, resolver, nil, nil, nil, nil, nil, nil, nil, nil, nil, nil, orderService, hub, guest)
	gin.SetMode(gin.TestMode)
	router, err := routers.NewRouter(s, []string{wsTestOrigin})
	if err != nil {
		t.Fatal(err)
	}
	// HTTPリクエストに同じGuestが引き継がれることを調べる読み取り専用probe。
	router.GET("/test/guest", func(c *gin.Context) {
		id, found, err := guest.GuestID(c.Request.Context())
		if err != nil || !found {
			c.Status(http.StatusUnauthorized)
			return
		}
		c.JSON(http.StatusOK, id.String())
	})
	fixture := &ordersWebSocketFixture{pool: pool, finished: make(chan struct{}, 8), hub: hub}
	handler := guardSessionUpgrade(account.LoadAndSave(guest.LoadAndSave(router)))
	fixture.server = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/ws/orders" {
			defer func() { fixture.finished <- struct{}{} }()
		}
		handler.ServeHTTP(w, r)
	}))
	t.Cleanup(fixture.server.Close)
	t.Cleanup(func() {
		ctx, cancel := context.WithTimeout(context.Background(), time.Second)
		defer cancel()
		if err := hub.Shutdown(ctx); err != nil {
			t.Error(err)
		}
	})
	return fixture
}

func TestOrdersHubFanoutAndAppShutdown(t *testing.T) {
	f := newOrdersWebSocketFixture(t)
	client := newWebSocketClient(t)
	first, second := f.dial(t, client), f.dial(t, client)
	guestID := uuid.MustParse(f.guestID(t, client))
	otherClient := newWebSocketClient(t)
	other := f.dial(t, otherClient)
	otherID := uuid.MustParse(f.guestID(t, otherClient))
	if guestID == otherID {
		t.Fatal("different browser cookies resolved to the same Guest")
	}
	const event = `{"type":"test.changed","data":{"version":1}}`
	const otherEvent = `{"type":"test.changed","data":{"version":2}}`
	if err := f.hub.Publish(guestID, []byte(event)); err != nil {
		t.Fatal(err)
	}
	if err := f.hub.Publish(otherID, []byte(otherEvent)); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	for _, item := range []struct {
		conn *websocket.Conn
		want string
	}{{first, event}, {second, event}, {other, otherEvent}} {
		_, message, err := item.conn.Read(ctx)
		if err != nil || string(message) != item.want {
			t.Fatalf("event = %s, error = %v; want %s", message, err, item.want)
		}
	}
	statuses := make(chan websocket.StatusCode, 3)
	for _, conn := range []*websocket.Conn{first, second, other} {
		go func() {
			_, _, err := conn.Read(ctx)
			statuses <- websocket.CloseStatus(err)
		}()
	}
	application := &App{httpServer: f.server.Config, dependencies: &dependencies{ordersHub: f.hub}}
	if err := application.shutdown(ctx); err != nil {
		t.Fatal(err)
	}
	for range 3 {
		if status := <-statuses; status != websocket.StatusGoingAway {
			t.Fatalf("app shutdown close = %v, want 1001", status)
		}
		f.waitFinished(t)
	}
}

func TestOrdersWebSocketInitialOrdersAndReconnect(t *testing.T) {
	f := newOrdersWebSocketFixture(t)
	client, otherClient := newWebSocketClient(t), newWebSocketClient(t)
	first, other := f.dial(t, client), f.dial(t, otherClient)
	guestID, otherID := uuid.MustParse(f.guestID(t, client)), uuid.MustParse(f.guestID(t, otherClient))
	first.CloseNow()
	other.CloseNow()
	f.waitFinished(t)
	f.waitFinished(t)
	expected := f.seedOrders(t, guestID, otherID)
	conn, rawOrders := f.dialReady(t, client)
	if len(rawOrders) != len(expected) {
		t.Fatalf("ready order count = %d, want %d", len(rawOrders), len(expected))
	}
	var wsOrders []routers.Order
	var pendingID uuid.UUID
	for _, raw := range rawOrders {
		var order routers.Order
		if err := json.Unmarshal(raw, &order); err != nil {
			t.Fatal(err)
		}
		if status, found := expected[order.Id]; !found || string(order.Status) != status {
			t.Fatalf("unexpected Guest order: %+v", order)
		}
		if order.StoreName != "snapshot store" || order.RoomName != "snapshot room" || order.TotalAmount != 600 ||
			len(order.Items) != 1 || order.Items[0].MenuName != "snapshot menu" || order.Items[0].UnitPrice != 250 ||
			len(order.Items[0].Toppings) != 1 || order.Items[0].Toppings[0].ToppingName != "snapshot topping" || order.Items[0].Toppings[0].UnitPrice != 50 {
			t.Fatalf("order snapshot changed: %+v", order)
		}
		var fields map[string]json.RawMessage
		if err := json.Unmarshal(raw, &fields); err != nil {
			t.Fatal(err)
		}
		for _, key := range []string{"guestId", "originCartId", "originCartVersion", "limitExemptedByAccountId"} {
			if _, found := fields[key]; found {
				t.Fatalf("internal field exposed: %s", key)
			}
		}
		if order.Status == routers.OrderStatus("pending") {
			pendingID = order.Id
			for _, key := range []string{"readyAt", "completedAt", "cancelledAt"} {
				if string(fields[key]) != "null" {
					t.Fatalf("pending %s = %s, want null", key, fields[key])
				}
			}
		}
		wsOrders = append(wsOrders, order)
	}
	response, err := client.Get(f.server.URL + "/orders")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	var rest routers.GetOrdersResponse
	if response.StatusCode != http.StatusOK {
		t.Fatalf("REST orders status = %d", response.StatusCode)
	}
	if err := json.NewDecoder(response.Body).Decode(&rest); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(wsOrders, rest.Data) {
		t.Fatalf("WS orders differ from REST: WS=%+v REST=%+v", wsOrders, rest.Data)
	}
	conn.CloseNow()
	f.waitFinished(t)
	// 切断中に変わった状態はイベント履歴ではなく、再接続時の一覧で同期する。
	if _, err := f.pool.Exec(t.Context(), `UPDATE orders SET status='ready',version=2,ready_at=updated_at WHERE id=$1`, pendingID); err != nil {
		t.Fatal(err)
	}
	_, reconnected := f.dialReady(t, client)
	found := false
	for _, raw := range reconnected {
		var order routers.Order
		if err := json.Unmarshal(raw, &order); err != nil {
			t.Fatal(err)
		}
		if order.Id == pendingID {
			found = true
			if order.Status != routers.OrderStatus("ready") || order.Version != 2 || order.ReadyAt == nil {
				t.Fatalf("reconnect did not return current order: %+v", order)
			}
		}
	}
	if !found {
		t.Fatal("reconnect lost existing order")
	}
	_, otherOrders := f.dialReady(t, otherClient)
	if len(otherOrders) != 1 {
		t.Fatalf("other Guest order count = %d, want 1", len(otherOrders))
	}
}

func (f *ordersWebSocketFixture) seedOrders(t *testing.T, guestID, otherID uuid.UUID) map[uuid.UUID]string {
	t.Helper()
	execSQL := func(query string, args ...any) {
		t.Helper()
		if _, err := f.pool.Exec(t.Context(), query, args...); err != nil {
			t.Fatal(err)
		}
	}
	storeID, menuID, toppingID := uuid.New(), uuid.New(), uuid.New()
	execSQL(`INSERT INTO rooms (name,sort_order) VALUES ('current room',0)`)
	execSQL(`INSERT INTO stores (id,name,room,description,image_object_key) VALUES ($1,'current store','current room','','test')`, storeID)
	execSQL(`INSERT INTO menus (id,store_id,name,description,unit_price,image_object_key) VALUES ($1,$2,'current menu','',999,'test')`, menuID, storeID)
	execSQL(`INSERT INTO toppings (id,store_id,name,unit_price) VALUES ($1,$2,'current topping',999)`, toppingID, storeID)
	cartID, otherCartID := uuid.New(), uuid.New()
	execSQL(`INSERT INTO carts (id,store_id,guest_id) VALUES ($1,$2,$3),($4,$2,$5)`, cartID, storeID, guestID, otherCartID, otherID)
	expected := make(map[uuid.UUID]string)
	for i, status := range []string{"pending", "ready", "completed", "cancelled", "ready"} {
		ownerID, originCartID := guestID, cartID
		if i == 4 {
			ownerID, originCartID = otherID, otherCartID
		}
		id, itemID := uuid.New(), uuid.New()
		created := time.Date(2026, 10, 10, 0, i, 0, 0, time.UTC)
		ready, updated := created.Add(time.Minute), created.Add(2*time.Minute)
		var readyAt, completedAt, cancelledAt *time.Time
		version := 1
		if status != "pending" {
			readyAt, version = &ready, 2
		}
		if status == "completed" {
			completedAt, version = &updated, 3
		}
		if status == "cancelled" {
			cancelledAt, version = &updated, 3
		}
		execSQL(`INSERT INTO orders (id,store_id,guest_id,status,total_amount,display_number,version,origin_cart_id,origin_cart_version,store_name,room_name,ready_at,completed_at,cancelled_at,created_at,updated_at)
			VALUES ($1,$2,$3,$4,600,$5,$6,$7,$5,'snapshot store','snapshot room',$8,$9,$10,$11,$12)`,
			id, storeID, ownerID, status, i+1, version, originCartID, readyAt, completedAt, cancelledAt, created, updated)
		execSQL(`INSERT INTO order_items (id,order_id,store_id,menu_id,menu_name,unit_price,quantity) VALUES ($1,$2,$3,$4,'snapshot menu',250,2)`, itemID, id, storeID, menuID)
		execSQL(`INSERT INTO order_item_toppings (order_item_id,store_id,topping_id,topping_name,unit_price) VALUES ($1,$2,$3,'snapshot topping',50)`, itemID, storeID, toppingID)
		if ownerID == guestID {
			expected[id] = status
		}
	}
	return expected
}

func TestOrdersWebSocketInitialQueryFailureClosesWithoutReady(t *testing.T) {
	f := newOrdersWebSocketFixture(t)
	if _, err := f.pool.Exec(t.Context(), "ALTER TABLE orders RENAME TO unavailable_orders"); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	conn, _, err := websocket.Dial(ctx, strings.Replace(f.server.URL, "http", "ws", 1)+"/ws/orders", &websocket.DialOptions{
		HTTPClient: newWebSocketClient(t), HTTPHeader: http.Header{"Origin": {wsTestOrigin}},
	})
	if err != nil {
		t.Fatal(err)
	}
	defer conn.CloseNow()
	_, _, err = conn.Read(ctx)
	if websocket.CloseStatus(err) != websocket.StatusInternalError {
		t.Fatalf("query failure close = %v, want 1011 without ready", err)
	}
	f.waitFinished(t)
}

func (f *ordersWebSocketFixture) dial(t *testing.T, client *http.Client) *websocket.Conn {
	t.Helper()
	conn, orders := f.dialReady(t, client)
	if len(orders) != 0 {
		t.Fatalf("unexpected orders: %s", orders)
	}
	return conn
}

func (f *ordersWebSocketFixture) dialReady(t *testing.T, client *http.Client) (*websocket.Conn, []json.RawMessage) {
	t.Helper()
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	conn, response, err := websocket.Dial(ctx, strings.Replace(f.server.URL, "http", "ws", 1)+"/ws/orders", &websocket.DialOptions{
		HTTPClient: client, HTTPHeader: http.Header{"Origin": {wsTestOrigin}},
	})
	if err != nil {
		t.Fatalf("dial: %v (response: %v)", err, response)
	}
	t.Cleanup(func() { conn.CloseNow() })
	messageType, message, err := conn.Read(ctx)
	if err != nil {
		t.Fatal(err)
	}
	var ready struct {
		Type string `json:"type"`
		Data struct {
			Orders []json.RawMessage `json:"orders"`
		} `json:"data"`
	}
	if err := json.Unmarshal(message, &ready); err != nil {
		t.Fatal(err)
	}
	if messageType != websocket.MessageText || ready.Type != "connection.ready" || ready.Data.Orders == nil {
		t.Fatalf("unexpected ready: %s (type: %v)", message, messageType)
	}
	return conn, ready.Data.Orders
}

func (f *ordersWebSocketFixture) waitFinished(t *testing.T) {
	t.Helper()
	select {
	case <-f.finished:
	case <-time.After(5 * time.Second):
		t.Fatal("WebSocket handler did not return after disconnection")
	}
}

func newWebSocketClient(t *testing.T) *http.Client {
	t.Helper()
	jar, err := cookiejar.New(nil)
	if err != nil {
		t.Fatal(err)
	}
	return &http.Client{Jar: jar, Timeout: 5 * time.Second}
}

func (f *ordersWebSocketFixture) guestID(t *testing.T, client *http.Client) string {
	t.Helper()
	response, err := client.Get(f.server.URL + "/test/guest")
	if err != nil {
		t.Fatal(err)
	}
	defer response.Body.Close()
	var id string
	if response.StatusCode != http.StatusOK {
		t.Fatalf("HTTP probe status = %d", response.StatusCode)
	}
	if err := json.NewDecoder(response.Body).Decode(&id); err != nil {
		t.Fatal(err)
	}
	return id
}

func TestOrdersWebSocketCookieReconnectAndCleanup(t *testing.T) {
	f := newOrdersWebSocketFixture(t)
	client := newWebSocketClient(t)
	conn := f.dial(t, client)
	id := f.guestID(t, client)
	u, _ := url.Parse(f.server.URL)
	cookies := client.Jar.Cookies(u)
	if len(cookies) != 1 || cookies[0].Name != "isc_fes_guest_session" {
		t.Fatalf("unexpected cookies: %v", cookies)
	}
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	// サーバーの受信処理が制御フレームへ応答することを確認する。
	readCtx := conn.CloseRead(ctx)
	if err := conn.Ping(readCtx); err != nil {
		t.Fatal(err)
	}
	if err := conn.Close(websocket.StatusNormalClosure, "browser closed"); err != nil {
		t.Fatal(err)
	}
	f.waitFinished(t)
	conn = f.dial(t, client)
	if actual := f.guestID(t, client); actual != id {
		t.Fatalf("reconnect Guest = %s, want %s", actual, id)
	}
	if actual := client.Jar.Cookies(u)[0].Value; actual != cookies[0].Value {
		t.Fatal("reconnect unexpectedly rotated fresh Guest cookie")
	}
	var count int
	if err := f.pool.QueryRow(t.Context(), "SELECT count(*) FROM guests").Scan(&count); err != nil || count != 1 {
		t.Fatalf("Guest count = %d, error = %v; want 1", count, err)
	}
	if err := conn.Write(ctx, websocket.MessageText, []byte(`{"type":"unsupported"}`)); err != nil {
		t.Fatal(err)
	}
	_, _, err := conn.Read(ctx)
	if websocket.CloseStatus(err) != websocket.StatusPolicyViolation {
		t.Fatalf("client application message close = %v; want 1008", err)
	}
	f.waitFinished(t)
	// TCP切断でもハンドラを終了し、接続を解放する。
	conn = f.dial(t, client)
	conn.CloseNow()
	f.waitFinished(t)
}

func TestOrdersWebSocketReplacesInvalidOrExpiredSession(t *testing.T) {
	for _, scenario := range []string{"unknown token", "expired", "invalid guest ID", "renew near expiry"} {
		t.Run(scenario, func(t *testing.T) {
			f := newOrdersWebSocketFixture(t)
			client := newWebSocketClient(t)
			u, _ := url.Parse(f.server.URL)
			oldID := ""
			token := "unknown-token"
			if scenario == "expired" {
				conn := f.dial(t, client)
				oldID = f.guestID(t, client)
				token = client.Jar.Cookies(u)[0].Value
				conn.CloseNow()
				f.waitFinished(t)
				if _, err := f.pool.Exec(t.Context(), "UPDATE guest_sessions SET expiry = now() - interval '1 second'"); err != nil {
					t.Fatal(err)
				}
			} else if scenario == "invalid guest ID" || scenario == "renew near expiry" {
				store := pgxstore.NewWithConfig(f.pool, pgxstore.Config{TableName: "guest_sessions", CleanUpInterval: time.Hour})
				t.Cleanup(store.StopCleanup)
				manager := scs.New()
				manager.Store, manager.HashTokenInStore = store, true
				manager.Lifetime = 29 * 24 * time.Hour
				ctx, err := manager.Load(t.Context(), "")
				if err != nil {
					t.Fatal(err)
				}
				value := "invalid UUID"
				if scenario == "renew near expiry" {
					id, err := db.New(f.pool).CreateGuest(t.Context())
					if err != nil {
						t.Fatal(err)
					}
					oldID, value = id.String(), id.String()
				}
				manager.Put(ctx, "guest_id", value)
				token, _, err = manager.Commit(ctx)
				if err != nil {
					t.Fatal(err)
				}
			}
			client.Jar.SetCookies(u, []*http.Cookie{{Name: "isc_fes_guest_session", Value: token, Path: "/"}})
			conn := f.dial(t, client)
			id := f.guestID(t, client)
			if scenario == "renew near expiry" {
				if id != oldID {
					t.Fatalf("renewed Guest = %s, want %s", id, oldID)
				}
			} else if id == oldID || id == "" {
				t.Fatalf("replacement Guest = %s, previous = %s", id, oldID)
			}
			if client.Jar.Cookies(u)[0].Value == token {
				t.Fatal("replacement/renewal did not issue a new cookie")
			}
			conn.CloseNow()
			f.waitFinished(t)
		})
	}
}
