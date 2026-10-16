package orders

import (
	"errors"
	"testing"

	"github.com/google/uuid"
	orderservice "github.com/isc-makeit/isc-fes/backend/services/orders"
)

func TestCreateOrderPostgresGuestWaitExemptions(t *testing.T) {
	for _, test := range []struct {
		name            string
		accountRole     string
		membershipStore string
		memberRole      string
		want            error
	}{
		{name: "anonymous guest", want: orderservice.ErrGuestOrderTooEarly},
		{name: "account without membership", accountRole: "member", want: orderservice.ErrGuestOrderTooEarly},
		{name: "own store staff", accountRole: "member", membershipStore: "target", memberRole: "staff"},
		{name: "own store manager", accountRole: "member", membershipStore: "target", memberRole: "manager"},
		{name: "other store staff", accountRole: "member", membershipStore: "other", memberRole: "staff", want: orderservice.ErrGuestOrderTooEarly},
		{name: "other store manager", accountRole: "member", membershipStore: "other", memberRole: "manager", want: orderservice.ErrGuestOrderTooEarly},
		{name: "admin without membership", accountRole: "admin"},
	} {
		t.Run(test.name, func(t *testing.T) {
			ctx, r, fixture := orderUpdateFixture(t)
			var guestID, cartID, menuID uuid.UUID
			if err := r.pool.QueryRow(ctx, `SELECT o.guest_id,o.origin_cart_id,i.menu_id FROM orders o
				JOIN order_items i ON i.order_id=o.id WHERE o.id=$1`, fixture.OrderID).Scan(&guestID, &cartID, &menuID); err != nil {
				t.Fatal(err)
			}
			// 新規ゲストの、販売中の商品があるカートを用意する。version=1は成立済み。
			execOrderSQL(t, ctx, r.pool, `UPDATE guests SET created_at=now() WHERE id=$1`, guestID)
			execOrderSQL(t, ctx, r.pool, `UPDATE stores SET closed_at=NULL,order_enabled=true WHERE id=$1`, fixture.StoreID)
			execOrderSQL(t, ctx, r.pool, `UPDATE menus SET sold_out=false,deleted_at=NULL WHERE id=$1`, menuID)
			execOrderSQL(t, ctx, r.pool, `UPDATE carts SET version=2 WHERE id=$1`, cartID)
			execOrderSQL(t, ctx, r.pool, `INSERT INTO cart_items (cart_id,store_id,menu_id,quantity) VALUES ($1,$2,$3,1)`, cartID, fixture.StoreID, menuID)
			execOrderSQL(t, ctx, r.pool, `INSERT INTO store_order_counters (store_id,last_number) VALUES ($1,1)`, fixture.StoreID)
			execOrderSQL(t, ctx, r.pool, `DELETE FROM store_members WHERE account_id=$1`, fixture.AccountID)
			input := orderservice.CreateRepositoryInput{
				CreateInput: orderservice.CreateInput{StoreID: fixture.StoreID, ExpectedCartVersion: 2}, GuestID: guestID,
			}
			if test.accountRole != "" {
				execOrderSQL(t, ctx, r.pool, `UPDATE accounts SET role=$2 WHERE id=$1`, fixture.AccountID, test.accountRole)
				input.AccountID = &fixture.AccountID
			}
			if test.membershipStore != "" {
				storeID := fixture.StoreID
				if test.membershipStore == "other" {
					storeID = uuid.New()
					execOrderSQL(t, ctx, r.pool, `INSERT INTO stores (id,name,room,description,image_object_key,review_status)
						VALUES ($1,'other','test','','test','approved')`, storeID)
				}
				execOrderSQL(t, ctx, r.pool, `INSERT INTO store_members (store_id,account_id,role) VALUES ($1,$2,$3)`, storeID, fixture.AccountID, test.memberRole)
			}

			result, err := r.CreateOrder(ctx, input)
			if !errors.Is(err, test.want) {
				t.Fatalf("CreateOrder error = %v, want %v", err, test.want)
			}
			if test.want == nil && (result.Replayed || result.Order.LimitExemptedByAccountID == nil || *result.Order.LimitExemptedByAccountID != fixture.AccountID) {
				t.Fatalf("expected a new exempt order, got %+v", result)
			}
		})
	}
}
