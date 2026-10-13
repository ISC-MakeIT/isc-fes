package activity_test

import (
	"errors"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	domain "github.com/isc-makeit/isc-fes/backend/domains/activity"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	orderentity "github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/services"
	orderservice "github.com/isc-makeit/isc-fes/backend/services/orders"
	menuservice "github.com/isc-makeit/isc-fes/backend/services/store/menus"
	toppingservice "github.com/isc-makeit/isc-fes/backend/services/store/toppings"
	"github.com/jackc/pgx/v5"
)

func TestActivityPostgresProductLifecycle(t *testing.T) {
	f := newFixture(t, true)
	topping, err := f.toppings.CreateTopping(f.ctx, f.storeID, "cheese", 100, f.accountID)
	if err != nil {
		t.Fatal(err)
	}
	created := f.lastLog(t, "topping.created", topping.ID)
	if created.before != nil || created.accountID == nil || *created.accountID != f.accountID {
		t.Fatalf("bad created event: %+v", created)
	}
	assertJSON(t, created.after, map[string]any{"name": "cheese", "unit_price": 100, "sold_out": false})
	price, soldOut := int32(0), true
	input := toppingservice.UpdateToppingRepositoryInput{AccountID: f.accountID, UnitPrice: &price, SoldOut: &soldOut}
	if _, err := f.toppings.UpdateToppingByToppingIDAndStoreID(f.ctx, topping.ID, f.storeID, input); err != nil {
		t.Fatal(err)
	}
	updated := f.lastLog(t, "topping.updated", topping.ID)
	assertJSON(t, updated.before, map[string]any{"unit_price": 100, "sold_out": false})
	assertJSON(t, updated.after, map[string]any{"unit_price": 0, "sold_out": true})
	n := f.logCount(t)
	if _, err := f.toppings.UpdateToppingByToppingIDAndStoreID(f.ctx, topping.ID, f.storeID, input); err != nil {
		t.Fatal(err)
	}
	if _, err := f.toppings.GetToppingsByStoreID(f.ctx, f.storeID); err != nil {
		t.Fatal(err)
	}
	if f.logCount(t) != n {
		t.Fatal("no-op/read recorded an event")
	}

	other, err := f.toppings.CreateTopping(f.ctx, f.storeID, "sauce", 50, f.accountID)
	if err != nil {
		t.Fatal(err)
	}
	first, second := f.createMenu(t, topping.ID, other.ID), f.createMenu(t, topping.ID)
	menuCreated := f.lastLog(t, "menu.created", first)
	assertJSON(t, menuCreated.after["topping_ids"], domain.UUIDSet([]uuid.UUID{topping.ID, other.ID}))
	reversed := []uuid.UUID{other.ID, topping.ID}
	n = f.logCount(t)
	if _, err := f.menus.UpdateMenuWithToppings(f.ctx, menuservice.UpdateMenuRepositoryInput{ID: first, StoreID: f.storeID, AccountID: f.accountID, ToppingIds: &reversed}); err != nil {
		t.Fatal(err)
	}
	if _, err := f.menus.GetMenusByStoreID(f.ctx, f.storeID); err != nil {
		t.Fatal(err)
	}
	if f.logCount(t) != n {
		t.Fatal("reordered set/read recorded an event")
	}
	menuPrice := int32(600)
	if _, err := f.menus.UpdateMenuWithToppings(f.ctx, menuservice.UpdateMenuRepositoryInput{ID: first, StoreID: f.storeID, AccountID: f.accountID, UnitPrice: &menuPrice, SoldOut: &soldOut}); err != nil {
		t.Fatal(err)
	}
	menuUpdated := f.lastLog(t, "menu.updated", first)
	assertJSON(t, menuUpdated.before, map[string]any{"unit_price": 500, "sold_out": false})
	assertJSON(t, menuUpdated.after, map[string]any{"unit_price": 600, "sold_out": true})

	n = f.logCount(t)
	if err := f.toppings.DeleteTopping(f.ctx, f.storeID, topping.ID, f.accountID); err != nil {
		t.Fatal(err)
	}
	if f.logCount(t) != n+3 {
		t.Fatal("delete must record topping and both affected menus")
	}
	deleted := f.lastLog(t, "topping.deleted", topping.ID)
	if deleted.after != nil {
		t.Fatal("deleted after must be null")
	}
	assertJSON(t, deleted.context["affected_menu_ids"], domain.UUIDSet([]uuid.UUID{first, second}))
	for _, id := range []uuid.UUID{first, second} {
		event := f.lastLog(t, "menu.updated", id)
		if event.context["cause"] != "topping.deleted" || event.context["topping_id"] != topping.ID.String() {
			t.Fatal("missing unlink cause")
		}
		if len(event.before) != 1 || len(event.after) != 1 {
			t.Fatal("unlink should only contain topping_ids")
		}
	}
	assertJSON(t, f.lastLog(t, "menu.updated", first).after["topping_ids"], []uuid.UUID{other.ID})
	assertJSON(t, f.lastLog(t, "menu.updated", second).after["topping_ids"], []uuid.UUID{})
	if _, err := f.menus.DeleteMenuByStoreIDAndMenuID(f.ctx, f.storeID, first, f.accountID); err != nil {
		t.Fatal(err)
	}
	menuDeleted := f.lastLog(t, "menu.deleted", first)
	if menuDeleted.after != nil || menuDeleted.before["name"] != "menu" {
		t.Fatal("bad deleted snapshot")
	}
	assertJSON(t, menuDeleted.before["topping_ids"], []uuid.UUID{other.ID})
	n = f.logCount(t)
	if _, err := f.menus.DeleteMenuByStoreIDAndMenuID(f.ctx, f.storeID, first, f.accountID); !errors.Is(err, pgx.ErrNoRows) {
		t.Fatalf("second delete: %v", err)
	}
	if f.logCount(t) != n {
		t.Fatal("failed delete recorded an event")
	}
}

func TestActivityPostgresStoreLifecycle(t *testing.T) {
	f := newFixture(t, true)
	ids := []uuid.UUID{uuid.New(), uuid.New()}
	for i, id := range ids {
		f.exec(t, `INSERT INTO allergens (id,name) VALUES ($1,$2)`, id, []string{"milk", "egg"}[i])
	}
	storeID := uuid.New()
	store, err := f.stores.CreateStoreApplication(f.ctx, services.CreateStoreApplicationInput{
		ID: storeID, AccountID: f.accountID, Name: "new store", Room: "activity-room", Description: "new description",
		ImageObjectKey: entities.NewImageObjectKey(uuid.New()), OrderEnabled: true, AllergenIds: ids,
	})
	if err != nil {
		t.Fatal(err)
	}
	created := f.lastLog(t, "store.created", store.ID)
	if created.before != nil || created.after["review_status"] != "pending" {
		t.Fatal("bad store created snapshot")
	}
	assertJSON(t, created.after["allergen_ids"], domain.UUIDSet(ids))
	if err := f.stores.UpdateStoreReviewStatus(f.ctx, storeID, entities.StoreReviewStatusApproved, f.accountID); err != nil {
		t.Fatal(err)
	}
	reviewed := f.lastLog(t, "store.review_status_changed", storeID)
	assertJSON(t, reviewed.before, map[string]any{"review_status": "pending"})
	assertJSON(t, reviewed.after, map[string]any{"review_status": "approved"})
	disabled, closed := false, true
	congestion := entities.StoreCongestionLevel(2)
	description := "updated"
	reversed := []uuid.UUID{ids[1], ids[0]}
	input := services.UpdateStoreRepositoryInput{AccountID: f.accountID, UpdateStoreInput: services.UpdateStoreInput{
		OrderEnabled: &disabled, Closed: &closed, CongestionLevel: &congestion, Description: &description, AllergenIDs: &reversed,
	}}
	if _, err := f.stores.UpdateStore(f.ctx, storeID, input); err != nil {
		t.Fatal(err)
	}
	updated := f.lastLog(t, "store.updated", storeID)
	if updated.before["order_enabled"] != true || updated.after["order_enabled"] != false || updated.after["closed_at"] == nil {
		t.Fatal("missing state changes")
	}
	if _, exists := updated.after["allergen_ids"]; exists {
		t.Fatal("reordered allergens are not a change")
	}
	n := f.logCount(t)
	if _, err := f.stores.UpdateStore(f.ctx, storeID, input); err != nil {
		t.Fatal(err)
	}
	if f.logCount(t) != n {
		t.Fatal("same store update recorded an event")
	}
	none := []uuid.UUID{}
	if _, err := f.stores.UpdateStore(f.ctx, storeID, services.UpdateStoreRepositoryInput{AccountID: f.accountID, UpdateStoreInput: services.UpdateStoreInput{AllergenIDs: &none}}); err != nil {
		t.Fatal(err)
	}
	assertJSON(t, f.lastLog(t, "store.updated", storeID).after, map[string]any{"allergen_ids": []uuid.UUID{}})
	reopen := false
	if _, err := f.stores.UpdateStore(f.ctx, storeID, services.UpdateStoreRepositoryInput{AccountID: f.accountID, UpdateStoreInput: services.UpdateStoreInput{Closed: &reopen}}); err != nil {
		t.Fatal(err)
	}
	assertJSON(t, f.lastLog(t, "store.updated", storeID).after, map[string]any{"closed_at": nil})
	n = f.logCount(t)
	if err := f.stores.UpdateStoreReviewStatus(f.ctx, storeID, entities.StoreReviewStatusRejected, f.accountID); !errors.Is(err, services.ErrInvalidStoreReviewStatusTransition) {
		t.Fatalf("invalid review: %v", err)
	}
	if f.logCount(t) != n {
		t.Fatal("failed review recorded an event")
	}
	rejectedID := uuid.New()
	f.exec(t, `INSERT INTO stores (id,name,room,description,image_object_key,review_status) VALUES ($1,'rejected','activity-room','','image','pending')`, rejectedID)
	if err := f.stores.UpdateStoreReviewStatus(f.ctx, rejectedID, entities.StoreReviewStatusRejected, f.accountID); err != nil {
		t.Fatal(err)
	}
	if f.lastLog(t, "store.review_status_changed", rejectedID).after["review_status"] != "rejected" {
		t.Fatal("rejection not recorded")
	}
}

func TestActivityPostgresOrderLifecycle(t *testing.T) {
	f := newFixture(t, true)
	input := f.seedCart(t)
	created, err := f.orders.CreateOrder(f.ctx, input)
	if err != nil {
		t.Fatal(err)
	}
	event := f.lastLog(t, "order.created", created.Order.ID)
	if event.accountID == nil || *event.accountID != f.accountID || event.guestID == nil || *event.guestID != input.GuestID {
		t.Fatal("order actor must preserve both identities")
	}
	assertJSON(t, event.after, map[string]any{"status": "pending", "version": 1, "guest_id": input.GuestID, "total_amount": 500, "display_number": 1})
	replay, err := f.orders.CreateOrder(f.ctx, input)
	if err != nil || !replay.Replayed || replay.Order.ID != created.Order.ID {
		t.Fatalf("replay=%+v err=%v", replay, err)
	}
	if f.logCount(t) != 1 {
		t.Fatal("replay recorded an event")
	}
	update := orderservice.UpdateRepositoryInput{AccountID: f.accountID, UpdateInput: orderservice.UpdateInput{
		StoreID: f.storeID, OrderID: created.Order.ID, Status: orderentity.OrderStatusReady, ExpectedVersion: 1,
	}}
	result, err := f.orders.UpdateOrder(f.ctx, update)
	if err != nil || !result.Changed {
		t.Fatalf("update=%+v err=%v", result, err)
	}
	event = f.lastLog(t, "order.status_changed", created.Order.ID)
	if !event.at.Equal(result.Order.UpdatedAt) || event.guestID != nil {
		t.Fatal("wrong update time or actor")
	}
	assertJSON(t, event.before, map[string]any{"status": "pending"})
	assertJSON(t, event.after, map[string]any{"status": "ready"})
	assertJSON(t, event.context, map[string]any{"version": 2})
	if _, err := f.orders.UpdateOrder(f.ctx, update); err != nil {
		t.Fatal(err)
	}
	update.Status = orderentity.OrderStatusCompleted
	if _, err := f.orders.UpdateOrder(f.ctx, update); !errors.Is(err, orderservice.ErrOrderVersionConflict) {
		t.Fatalf("stale update=%v", err)
	}
	unauthorized := update
	unauthorized.AccountID = uuid.New()
	if _, err := f.orders.UpdateOrder(f.ctx, unauthorized); !errors.Is(err, services.ErrForbidden) {
		t.Fatalf("unauthorized update=%v", err)
	}
	if _, err := f.orders.GetOrdersByGuestID(f.ctx, input.GuestID, nil); err != nil {
		t.Fatal(err)
	}
	if f.logCount(t) != 2 {
		t.Fatal("no-op/conflict/unauthorized/read recorded an event")
	}
	update.ExpectedVersion = 2
	if _, err := f.orders.UpdateOrder(f.ctx, update); err != nil {
		t.Fatal(err)
	}
	assertJSON(t, f.lastLog(t, "order.status_changed", created.Order.ID).after, map[string]any{"status": "completed"})
	guestOnly := f.seedCart(t)
	guestOnly.AccountID = nil
	guestOrder, err := f.orders.CreateOrder(f.ctx, guestOnly)
	if err != nil {
		t.Fatal(err)
	}
	guestEvent := f.lastLog(t, "order.created", guestOrder.Order.ID)
	if guestEvent.accountID != nil || guestEvent.guestID == nil || *guestEvent.guestID != guestOnly.GuestID {
		t.Fatal("bad guest-only actor")
	}
}

func TestActivityPostgresBaseline(t *testing.T) {
	f := newFixture(t, false)
	topping, err := f.q.CreateTopping(f.ctx, sqlc.CreateToppingParams{StoreID: f.storeID, Name: "topping", UnitPrice: 100})
	if err != nil {
		t.Fatal(err)
	}
	menuID := uuid.New()
	f.exec(t, `INSERT INTO menus (id,store_id,name,description,unit_price,image_object_key,sold_out) VALUES ($1,$2,'menu','desc',500,'image',true)`, menuID, f.storeID)
	f.exec(t, `INSERT INTO menu_toppings (store_id,menu_id,topping_id) VALUES ($1,$2,$3)`, f.storeID, menuID, topping.ID)
	f.exec(t, `INSERT INTO menus (store_id,name,description,unit_price,image_object_key,deleted_at) VALUES ($1,'deleted','',0,'image',now())`, f.storeID)
	f.exec(t, `INSERT INTO toppings (store_id,name,unit_price,deleted_at) VALUES ($1,'deleted',0,now())`, f.storeID)
	allergen := uuid.New()
	f.exec(t, `INSERT INTO allergens (id,name) VALUES ($1,'milk')`, allergen)
	f.exec(t, `INSERT INTO store_allergens (store_id,allergen_id) VALUES ($1,$2)`, f.storeID, allergen)
	pendingID := uuid.New()
	f.exec(t, `INSERT INTO stores (id,name,room,description,image_object_key,review_status) VALUES ($1,'pending','activity-room','','image','pending')`, pendingID)
	data, err := os.ReadFile("../../db/migrations/000025_create_activity_log.up.sql")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := f.admin.Exec(f.ctx, string(data)); err != nil {
		t.Fatal(err)
	}
	if f.logCount(t) != 4 || f.count(t, `SELECT count(DISTINCT occurred_at) FROM activity_log`) != 1 {
		t.Fatal("wrong baseline count or timestamp")
	}
	if f.count(t, `SELECT count(*) FROM activity_log WHERE actor_account_id IS NOT NULL OR actor_guest_id IS NOT NULL OR payload->'before'<>'null'::jsonb`) != 0 {
		t.Fatal("baseline has actor or before state")
	}
	assertJSON(t, f.lastLog(t, "menu.baseline", menuID).after["topping_ids"], []uuid.UUID{topping.ID})
	assertJSON(t, f.lastLog(t, "store.baseline", f.storeID).after["allergen_ids"], []uuid.UUID{allergen})
	if f.lastLog(t, "store.baseline", pendingID).after["review_status"] != "pending" {
		t.Fatal("pending store excluded")
	}
	// Baseline and runtime snapshots must agree, including non-nil empty sets and nullable state.
	n := f.logCount(t)
	same := int32(500)
	if _, err := f.menus.UpdateMenuWithToppings(f.ctx, menuservice.UpdateMenuRepositoryInput{ID: menuID, StoreID: f.storeID, AccountID: f.accountID, UnitPrice: &same}); err != nil {
		t.Fatal(err)
	}
	if f.logCount(t) != n {
		t.Fatal("baseline-era no-op produced an event")
	}
}

func TestActivityPostgresAssociationChanges(t *testing.T) {
	f := newFixture(t, true)
	topping, err := f.toppings.CreateTopping(f.ctx, f.storeID, "cheese", 100, f.accountID)
	if err != nil {
		t.Fatal(err)
	}
	menuID := f.createMenu(t)
	ids := []uuid.UUID{topping.ID}
	if _, err := f.menus.UpdateMenuWithToppings(f.ctx, menuservice.UpdateMenuRepositoryInput{ID: menuID, StoreID: f.storeID, AccountID: f.accountID, ToppingIds: &ids}); err != nil {
		t.Fatal(err)
	}
	event := f.lastLog(t, "menu.updated", menuID)
	assertJSON(t, event.before, map[string]any{"topping_ids": []uuid.UUID{}})
	assertJSON(t, event.after, map[string]any{"topping_ids": ids})
	empty := []uuid.UUID{}
	if _, err := f.menus.UpdateMenuWithToppings(f.ctx, menuservice.UpdateMenuRepositoryInput{ID: menuID, StoreID: f.storeID, AccountID: f.accountID, ToppingIds: &empty}); err != nil {
		t.Fatal(err)
	}
	assertJSON(t, f.lastLog(t, "menu.updated", menuID).after, map[string]any{"topping_ids": empty})
	allergenID := uuid.New()
	f.exec(t, `INSERT INTO allergens (id,name) VALUES ($1,'milk')`, allergenID)
	allergens := []uuid.UUID{allergenID}
	if _, err := f.stores.UpdateStore(f.ctx, f.storeID, services.UpdateStoreRepositoryInput{AccountID: f.accountID, UpdateStoreInput: services.UpdateStoreInput{AllergenIDs: &allergens}}); err != nil {
		t.Fatal(err)
	}
	storeEvent := f.lastLog(t, "store.updated", f.storeID)
	assertJSON(t, storeEvent.before, map[string]any{"allergen_ids": []uuid.UUID{}})
	assertJSON(t, storeEvent.after, map[string]any{"allergen_ids": allergens})
}

func TestActivityPostgresOrderCancellation(t *testing.T) {
	f := newFixture(t, true)
	order, err := f.orders.CreateOrder(f.ctx, f.seedCart(t))
	if err != nil {
		t.Fatal(err)
	}
	input := orderservice.UpdateRepositoryInput{AccountID: f.accountID, UpdateInput: orderservice.UpdateInput{
		StoreID: f.storeID, OrderID: order.Order.ID, Status: orderentity.OrderStatusReady, ExpectedVersion: 1,
	}}
	if _, err := f.orders.UpdateOrder(f.ctx, input); err != nil {
		t.Fatal(err)
	}
	input.Status, input.ExpectedVersion = orderentity.OrderStatusCancelled, 2
	n := f.logCount(t)
	if _, err := f.orders.UpdateOrder(f.ctx, input); !errors.Is(err, orderservice.ErrCancelTooEarly) {
		t.Fatalf("early cancellation: %v", err)
	}
	if f.logCount(t) != n {
		t.Fatal("failed cancellation recorded an event")
	}
	// Move the fixture across the cancellation boundary without waiting fifteen minutes.
	f.exec(t, `UPDATE orders SET created_at=now()-interval '17 minutes', ready_at=now()-interval '16 minutes', updated_at=now()-interval '16 minutes' WHERE id=$1`, order.Order.ID)
	result, err := f.orders.UpdateOrder(f.ctx, input)
	if err != nil {
		t.Fatal(err)
	}
	event := f.lastLog(t, "order.status_changed", order.Order.ID)
	assertJSON(t, event.before, map[string]any{"status": "ready"})
	assertJSON(t, event.after, map[string]any{"status": "cancelled"})
	assertJSON(t, event.context, map[string]any{"version": 3})
	if !event.at.Equal(result.Order.UpdatedAt) {
		t.Fatal("cancellation event time differs from update")
	}
}
