package activity_test

import (
	"encoding/json"
	"errors"
	"fmt"
	"testing"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	menuentity "github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	orderentity "github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/services"
	orderservice "github.com/isc-makeit/isc-fes/backend/services/orders"
	menuservice "github.com/isc-makeit/isc-fes/backend/services/store/menus"
	toppingservice "github.com/isc-makeit/isc-fes/backend/services/store/toppings"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

func (f *fixture) databaseSnapshot(t *testing.T) map[string]string {
	t.Helper()
	result := map[string]string{}
	for _, table := range []string{"stores", "store_members", "store_allergens", "menus", "menu_toppings", "toppings", "orders", "order_items", "order_item_toppings", "carts", "cart_items", "cart_item_toppings", "store_order_counters", "activity_log"} {
		var data []byte
		query := `SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) FROM ` + pgx.Identifier{table}.Sanitize() + ` t`
		if err := f.pool.QueryRow(f.ctx, query).Scan(&data); err != nil {
			t.Fatal(err)
		}
		result[table] = string(data)
	}
	return result
}

func TestActivityPostgresInsertFailureRollsBackEveryMutation(t *testing.T) {
	tests := []struct{ name, eventType string }{
		{"create menu", "menu.created"}, {"update menu", "menu.updated"}, {"delete menu", "menu.deleted"},
		{"create topping", "topping.created"}, {"update topping", "topping.updated"}, {"delete topping", "topping.deleted"},
		{"unlink menu during topping deletion", "menu.updated"},
		{"create store", "store.created"}, {"update store", "store.updated"}, {"review store", "store.review_status_changed"},
		{"create order", "order.created"}, {"update order", "order.status_changed"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			f := newFixture(t, true)
			topping, err := f.q.CreateTopping(f.ctx, sqlc.CreateToppingParams{StoreID: f.storeID, Name: "cheese", UnitPrice: 100})
			if err != nil {
				t.Fatal(err)
			}
			menuID := uuid.New()
			f.exec(t, `INSERT INTO menus (id,store_id,name,description,unit_price,image_object_key) VALUES ($1,$2,'menu','',500,'image')`, menuID, f.storeID)
			f.exec(t, `INSERT INTO menu_toppings (store_id,menu_id,topping_id) VALUES ($1,$2,$3)`, f.storeID, menuID, topping.ID)
			pendingID := uuid.New()
			f.exec(t, `INSERT INTO stores (id,name,room,description,image_object_key,review_status) VALUES ($1,'pending','activity-room','','image','pending')`, pendingID)
			allergen := uuid.New()
			f.exec(t, `INSERT INTO allergens (id,name) VALUES ($1,'milk')`, allergen)
			cart := f.seedCart(t)
			order, err := f.orders.CreateOrder(f.ctx, cart)
			if err != nil {
				t.Fatal(err)
			}
			newCart := f.seedCart(t)
			before := f.databaseSnapshot(t)
			// NOT VALID leaves pre-existing events alone but rejects matching new INSERTs.
			f.exec(t, fmt.Sprintf(`ALTER TABLE activity_log ADD CONSTRAINT activity_test_reject CHECK (event_type <> '%s') NOT VALID`, test.eventType))
			price := int32(600)
			empty := []uuid.UUID{}
			disabled := false
			allergens := []uuid.UUID{allergen}
			switch test.name {
			case "create menu":
				_, err = f.menus.CreateMenuWithToppings(f.ctx, menuservice.CreateMenuRepositoryInput{ID: uuid.New(), StoreID: f.storeID, AccountID: f.accountID, Name: "new", UnitPrice: 100, ImageObjectKey: menuentity.NewMenuImageObjectKey(uuid.New()), ToppingIds: []uuid.UUID{topping.ID}})
			case "update menu":
				_, err = f.menus.UpdateMenuWithToppings(f.ctx, menuservice.UpdateMenuRepositoryInput{ID: menuID, StoreID: f.storeID, AccountID: f.accountID, UnitPrice: &price, ToppingIds: &empty})
			case "delete menu":
				_, err = f.menus.DeleteMenuByStoreIDAndMenuID(f.ctx, f.storeID, menuID, f.accountID)
			case "create topping":
				_, err = f.toppings.CreateTopping(f.ctx, f.storeID, "new", 10, f.accountID)
			case "update topping":
				_, err = f.toppings.UpdateToppingByToppingIDAndStoreID(f.ctx, topping.ID, f.storeID, toppingservice.UpdateToppingRepositoryInput{AccountID: f.accountID, UnitPrice: &price})
			case "delete topping", "unlink menu during topping deletion":
				err = f.toppings.DeleteTopping(f.ctx, f.storeID, topping.ID, f.accountID)
			case "create store":
				_, err = f.stores.CreateStoreApplication(f.ctx, services.CreateStoreApplicationInput{ID: uuid.New(), AccountID: f.accountID, Name: "new", Room: "activity-room", ImageObjectKey: entities.NewImageObjectKey(uuid.New()), OrderEnabled: true, AllergenIds: allergens})
			case "update store":
				_, err = f.stores.UpdateStore(f.ctx, f.storeID, services.UpdateStoreRepositoryInput{AccountID: f.accountID, UpdateStoreInput: services.UpdateStoreInput{OrderEnabled: &disabled, AllergenIDs: &allergens}})
			case "review store":
				err = f.stores.UpdateStoreReviewStatus(f.ctx, pendingID, entities.StoreReviewStatusApproved, f.accountID)
			case "create order":
				_, err = f.orders.CreateOrder(f.ctx, newCart)
			case "update order":
				_, err = f.orders.UpdateOrder(f.ctx, orderservice.UpdateRepositoryInput{AccountID: f.accountID, UpdateInput: orderservice.UpdateInput{StoreID: f.storeID, OrderID: order.Order.ID, Status: orderentity.OrderStatusReady, ExpectedVersion: 1}})
			}
			var databaseError *pgconn.PgError
			if !errors.As(err, &databaseError) || databaseError.ConstraintName != "activity_test_reject" {
				t.Fatalf("expected log INSERT constraint failure, got %v", err)
			}
			after := f.databaseSnapshot(t)
			for table, rows := range before {
				if rows != after[table] {
					t.Errorf("%s changed despite failed activity INSERT: before=%s after=%s", table, rows, after[table])
				}
			}
		})
	}
}

func TestActivityPostgresConcurrentMenuUpdatesUseLockedState(t *testing.T) {
	f := newFixture(t, true)
	menuID := f.createMenu(t)
	start := make(chan struct{})
	results := make(chan error, 2)
	for _, price := range []int32{600, 700} {
		go func() {
			<-start
			_, err := f.menus.UpdateMenuWithToppings(f.ctx, menuservice.UpdateMenuRepositoryInput{ID: menuID, StoreID: f.storeID, AccountID: f.accountID, UnitPrice: &price})
			results <- err
		}()
	}
	close(start)
	for range 2 {
		if err := <-results; err != nil {
			t.Fatal(err)
		}
	}
	rows, err := f.pool.Query(f.ctx, `SELECT payload FROM activity_log WHERE subject_id=$1 AND event_type='menu.updated' ORDER BY occurred_at,id`, menuID)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	previous, changes := float64(500), 0
	for rows.Next() {
		var data []byte
		if err := rows.Scan(&data); err != nil {
			t.Fatal(err)
		}
		var payload struct{ Before, After map[string]float64 }
		if err := json.Unmarshal(data, &payload); err != nil {
			t.Fatal(err)
		}
		if payload.Before["unit_price"] != previous {
			t.Fatalf("history chain broke: previous=%v payload=%s", previous, data)
		}
		previous = payload.After["unit_price"]
		changes++
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	if changes != 2 {
		t.Fatalf("changes=%d, want 2", changes)
	}
	if got := f.count(t, `SELECT unit_price FROM menus WHERE id=$1`, menuID); float64(got) != previous {
		t.Fatalf("final price=%d history=%v", got, previous)
	}
}

func TestActivityPostgresConcurrentReviewsRecordOnlyWinner(t *testing.T) {
	f := newFixture(t, true)
	f.exec(t, `UPDATE stores SET review_status='pending' WHERE id=$1`, f.storeID)
	start := make(chan struct{})
	results := make(chan error, 2)
	for _, status := range []entities.StoreReviewStatus{entities.StoreReviewStatusApproved, entities.StoreReviewStatusRejected} {
		go func() { <-start; results <- f.stores.UpdateStoreReviewStatus(f.ctx, f.storeID, status, f.accountID) }()
	}
	close(start)
	successes, conflicts := 0, 0
	for range 2 {
		err := <-results
		switch {
		case err == nil:
			successes++
		case errors.Is(err, services.ErrInvalidStoreReviewStatusTransition):
			conflicts++
		default:
			t.Fatal(err)
		}
	}
	if successes != 1 || conflicts != 1 || f.logCount(t) != 1 {
		t.Fatalf("success=%d conflict=%d logs=%d", successes, conflicts, f.logCount(t))
	}
}

func TestActivityPostgresConcurrentOrderCreation(t *testing.T) {
	f := newFixture(t, true)
	input := f.seedCart(t)
	start := make(chan struct{})
	type outcome struct {
		result orderservice.CreateResult
		err    error
	}
	results := make(chan outcome, 2)
	for range 2 {
		go func() { <-start; result, err := f.orders.CreateOrder(f.ctx, input); results <- outcome{result, err} }()
	}
	close(start)
	replays := 0
	var orderID uuid.UUID
	for range 2 {
		got := <-results
		if got.err != nil {
			t.Fatal(got.err)
		}
		if got.result.Replayed {
			replays++
		}
		if orderID != uuid.Nil && got.result.Order.ID != orderID {
			t.Fatal("concurrent retry created another order")
		}
		orderID = got.result.Order.ID
	}
	if replays != 1 || f.logCount(t) != 1 {
		t.Fatalf("replays=%d logs=%d", replays, f.logCount(t))
	}
}
