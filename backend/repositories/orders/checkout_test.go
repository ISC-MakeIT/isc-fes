package orders

import (
	"errors"
	"math"
	"testing"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/services"
	orderservice "github.com/isc-makeit/isc-fes/backend/services/orders"
)

// 既存の実DB用fixtureを使い、事前チェックと新規注文の判定を同じ状態で比較する。
func TestCheckoutPostgresMatchesCreateOrder(t *testing.T) {
	ctx, r, fixture := orderUpdateFixture(t)
	var guestID, cartID, menuID uuid.UUID
	if err := r.pool.QueryRow(ctx, `SELECT guest_id,origin_cart_id FROM orders WHERE id=$1`, fixture.OrderID).Scan(&guestID, &cartID); err != nil {
		t.Fatal(err)
	}
	if err := r.pool.QueryRow(ctx, `SELECT menu_id FROM order_items WHERE order_id=$1`, fixture.OrderID).Scan(&menuID); err != nil {
		t.Fatal(err)
	}
	// version=1にはfixtureの成立済み注文があるため、新規注文はversion=2で比較する。
	execOrderSQL(t, ctx, r.pool, `UPDATE carts SET version=2 WHERE id=$1`, cartID)
	execOrderSQL(t, ctx, r.pool, `INSERT INTO store_order_counters (store_id,last_number) VALUES ($1,1)`, fixture.StoreID)
	input := orderservice.CreateRepositoryInput{
		CreateInput: orderservice.CreateInput{StoreID: fixture.StoreID, ExpectedCartVersion: 2}, GuestID: guestID,
	}
	assertDenied := func(t *testing.T, input orderservice.CreateRepositoryInput, want error) {
		t.Helper()
		checkErr := r.CheckCheckout(ctx, input)
		_, createErr := r.CreateOrder(ctx, input)
		if !errors.Is(checkErr, want) || !errors.Is(createErr, want) {
			t.Fatalf("check = %v, create = %v, want %v", checkErr, createErr, want)
		}
	}
	assertDenied(t, input, orderservice.ErrStoreClosed) // 閉店を受付停止・空カートより優先。
	execOrderSQL(t, ctx, r.pool, `UPDATE stores SET closed_at=NULL WHERE id=$1`, input.StoreID)
	assertDenied(t, input, orderservice.ErrStoreOrderDisabled)
	execOrderSQL(t, ctx, r.pool, `UPDATE stores SET order_enabled=true WHERE id=$1`, input.StoreID)
	stale := input
	stale.ExpectedCartVersion = 3
	assertDenied(t, stale, orderservice.ErrCartVersionConflict)
	assertDenied(t, input, orderservice.ErrCartEmpty)
	missing := input
	missing.GuestID = uuid.New()
	if err := r.CheckCheckout(ctx, missing); !errors.Is(err, orderservice.ErrCartEmpty) {
		t.Fatalf("missing cart: %v", err)
	}
	missing.StoreID = uuid.New()
	missing.GuestID = guestID
	assertDenied(t, missing, services.ErrNotFound)
	execOrderSQL(t, ctx, r.pool, `UPDATE carts SET version=$2 WHERE id=$1`, cartID, int32(math.MaxInt32))
	maxVersion := input
	maxVersion.ExpectedCartVersion = math.MaxInt32
	assertDenied(t, maxVersion, orderservice.ErrCartVersionConflict)
	execOrderSQL(t, ctx, r.pool, `UPDATE carts SET version=2 WHERE id=$1`, cartID)
	execOrderSQL(t, ctx, r.pool, `INSERT INTO cart_items (cart_id,store_id,menu_id,quantity) VALUES ($1,$2,$3,1)`, cartID, input.StoreID, menuID)
	assertDenied(t, input, orderservice.ErrUnavailableItems)
	execOrderSQL(t, ctx, r.pool, `UPDATE menus SET sold_out=false,deleted_at=NULL WHERE id=$1`, menuID)

	// 他店舗のready注文も件数に含まれる。
	otherStore, otherCart := uuid.New(), uuid.New()
	execOrderSQL(t, ctx, r.pool, `INSERT INTO stores (id,name,room,description,image_object_key,review_status) VALUES ($1,'other','test','','test','approved')`, otherStore)
	execOrderSQL(t, ctx, r.pool, `INSERT INTO carts (id,store_id,guest_id) VALUES ($1,$2,$3)`, otherCart, otherStore, guestID)
	execOrderSQL(t, ctx, r.pool, `INSERT INTO orders (store_id,guest_id,total_amount,display_number,origin_cart_id,origin_cart_version,store_name,room_name,status,ready_at)
		VALUES ($1,$2,0,1,$3,1,'other','test','ready',now())`, otherStore, guestID, otherCart)
	assertDenied(t, input, orderservice.ErrOrderLimitReached)
	for _, role := range []string{"staff", "manager"} {
		execOrderSQL(t, ctx, r.pool, `UPDATE store_members SET role=$2 WHERE store_id=$1 AND account_id=$3`, input.StoreID, role, fixture.AccountID)
		exempt := input
		exempt.AccountID = &fixture.AccountID
		if err := r.CheckCheckout(ctx, exempt); err != nil {
			t.Fatalf("%s exemption: %v", role, err)
		}
	}
	// 他店舗の所属だけでは免除されない。
	execOrderSQL(t, ctx, r.pool, `DELETE FROM store_members WHERE store_id=$1 AND account_id=$2`, input.StoreID, fixture.AccountID)
	execOrderSQL(t, ctx, r.pool, `INSERT INTO store_members (store_id,account_id,role) VALUES ($1,$2,'manager')`, otherStore, fixture.AccountID)
	nonmember := input
	nonmember.AccountID = &fixture.AccountID
	assertDenied(t, nonmember, orderservice.ErrOrderLimitReached)

	// 免除注文を除外すると通常注文は1件。GETはカート・注文を変更しない。
	execOrderSQL(t, ctx, r.pool, `UPDATE orders SET limit_exempted_by_account_id=$2 WHERE store_id=$1`, otherStore, fixture.AccountID)
	if err := r.CheckCheckout(ctx, input); err != nil {
		t.Fatal(err)
	}
	var version, cartItems, orderCount int
	if err := r.pool.QueryRow(ctx, `SELECT version,(SELECT count(*) FROM cart_items WHERE cart_id=$1),(SELECT count(*) FROM orders) FROM carts WHERE id=$1`, cartID).Scan(&version, &cartItems, &orderCount); err != nil {
		t.Fatal(err)
	}
	if version != 2 || cartItems != 1 || orderCount != 2 {
		t.Fatalf("GET changed state: version=%d, items=%d, orders=%d", version, cartItems, orderCount)
	}
	// GET成功後に受付が停止すれば、POSTでも最新状態で拒否する。
	execOrderSQL(t, ctx, r.pool, `UPDATE stores SET order_enabled=false WHERE id=$1`, input.StoreID)
	assertDenied(t, input, orderservice.ErrStoreOrderDisabled)
	execOrderSQL(t, ctx, r.pool, `UPDATE stores SET order_enabled=true WHERE id=$1`, input.StoreID)
	created, err := r.CreateOrder(ctx, input)
	if err != nil || created.Replayed || created.Order.TotalAmount != 999 || len(created.Order.Items) != 1 {
		t.Fatalf("create after check: %+v, %v", created, err)
	}
	// 現在の店舗が閉店しても、成立済み注文への再送は従来どおり成功する。
	execOrderSQL(t, ctx, r.pool, `UPDATE stores SET closed_at=now() WHERE id=$1`, input.StoreID)
	if err := r.CheckCheckout(ctx, input); !errors.Is(err, orderservice.ErrStoreClosed) {
		t.Fatalf("new order check after closing: %v", err)
	}
	replayed, err := r.CreateOrder(ctx, input)
	if err != nil || !replayed.Replayed || replayed.Order.ID != created.Order.ID {
		t.Fatalf("replay after closing: %+v, %v", replayed, err)
	}
}
