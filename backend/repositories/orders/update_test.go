package orders

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	domain "github.com/isc-makeit/isc-fes/backend/domains/entities/orders"
	"github.com/isc-makeit/isc-fes/backend/services"
	orderservice "github.com/isc-makeit/isc-fes/backend/services/orders"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// TEST_ORDER_DATABASE_URLで指定されたDBにテスト専用schemaを作り、終了時に削除する。
// 実際のPostgreSQLでトランザクション・制約・競合を確認する。
func orderUpdateFixture(t *testing.T) (context.Context, *OrderRepository, orderservice.UpdateRepositoryInput) {
	t.Helper()
	dsn := os.Getenv("TEST_ORDER_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_ORDER_DATABASE_URL is required for PostgreSQL integration tests")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	t.Cleanup(cancel)
	admin, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { admin.Close(context.Background()) })
	schema := "order_update_" + uuid.New().String()
	quoted := pgx.Identifier{schema}.Sanitize()
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+quoted); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		if _, err := admin.Exec(context.Background(), "DROP SCHEMA "+quoted+" CASCADE"); err != nil {
			t.Error(err)
		}
	})
	if _, err := admin.Exec(ctx, "SET search_path TO "+quoted); err != nil {
		t.Fatal(err)
	}
	migrations, err := filepath.Glob("../../db/migrations/*.up.sql")
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
	config.ConnConfig.RuntimeParams["search_path"] = quoted
	config.ConnConfig.RuntimeParams["application_name"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, config)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(pool.Close)
	r := NewOrderRepository(sqlc.New(pool), pool)
	input := orderservice.UpdateRepositoryInput{
		UpdateInput: orderservice.UpdateInput{StoreID: uuid.New(), OrderID: uuid.New(), Status: domain.OrderStatusReady, ExpectedVersion: 1},
		AccountID:   uuid.New(),
	}
	guestID, cartID, menuID, toppingID := uuid.New(), uuid.New(), uuid.New(), uuid.New()
	execOrderSQL(t, ctx, pool, `INSERT INTO rooms (name, sort_order) VALUES ('test', 0)`)
	execOrderSQL(t, ctx, pool, `INSERT INTO accounts (id,google_sub,email) VALUES ($1,'test','test@example.com')`, input.AccountID)
	execOrderSQL(t, ctx, pool, `INSERT INTO stores (id,name,room,description,image_object_key,review_status,closed_at,order_enabled)
		VALUES ($1,'current store','test','','test','approved',now(),false)`, input.StoreID)
	execOrderSQL(t, ctx, pool, `INSERT INTO store_members (store_id,account_id,role) VALUES ($1,$2,'staff')`, input.StoreID, input.AccountID)
	execOrderSQL(t, ctx, pool, `INSERT INTO guests (id) VALUES ($1)`, guestID)
	execOrderSQL(t, ctx, pool, `INSERT INTO carts (id,store_id,guest_id) VALUES ($1,$2,$3)`, cartID, input.StoreID, guestID)
	execOrderSQL(t, ctx, pool, `INSERT INTO orders (id,store_id,guest_id,total_amount,display_number,origin_cart_id,origin_cart_version,store_name,room_name)
		VALUES ($1,$2,$3,600,1,$4,1,'snapshot store','snapshot room')`, input.OrderID, input.StoreID, guestID, cartID)
	execOrderSQL(t, ctx, pool, `INSERT INTO menus (id,store_id,name,description,unit_price,image_object_key,sold_out,deleted_at)
		VALUES ($1,$2,'current menu','',999,'test',true,now())`, menuID, input.StoreID)
	execOrderSQL(t, ctx, pool, `INSERT INTO toppings (id,store_id,name,unit_price,sold_out,deleted_at)
		VALUES ($1,$2,'current topping',999,true,now())`, toppingID, input.StoreID)
	itemID := uuid.New()
	execOrderSQL(t, ctx, pool, `INSERT INTO order_items (id,order_id,store_id,menu_id,menu_name,unit_price,quantity)
		VALUES ($1,$2,$3,$4,'snapshot menu',250,2)`, itemID, input.OrderID, input.StoreID, menuID)
	execOrderSQL(t, ctx, pool, `INSERT INTO order_item_toppings (order_item_id,store_id,topping_id,topping_name,unit_price)
		VALUES ($1,$2,$3,'snapshot topping',50)`, itemID, input.StoreID, toppingID)
	return ctx, r, input
}

func execOrderSQL(t *testing.T, ctx context.Context, pool *pgxpool.Pool, query string, args ...any) {
	t.Helper()
	if _, err := pool.Exec(ctx, query, args...); err != nil {
		t.Fatal(err)
	}
}

func TestUpdateOrderPostgresLifecycle(t *testing.T) {
	ctx, r, input := orderUpdateFixture(t)
	ready, err := r.UpdateOrder(ctx, input)
	if err != nil {
		t.Fatal(err)
	}
	if ready.Status != domain.OrderStatusReady || ready.Version != 2 || ready.ReadyAt == nil || !ready.ReadyAt.Equal(ready.UpdatedAt) {
		t.Fatalf("unexpected ready order: %+v", ready)
	}
	if ready.TotalAmount != 600 || ready.StoreName != "snapshot store" || ready.RoomName != "snapshot room" ||
		len(ready.Items) != 1 || ready.Items[0].MenuName != "snapshot menu" || ready.Items[0].UnitPrice != 250 ||
		len(ready.Items[0].Toppings) != 1 || ready.Items[0].Toppings[0].ToppingName != "snapshot topping" || ready.Items[0].Toppings[0].UnitPrice != 50 {
		t.Fatalf("snapshot changed: %+v", ready)
	}
	replay, err := r.UpdateOrder(ctx, input)
	if err != nil || !reflect.DeepEqual(replay, ready) {
		t.Fatalf("replay = %+v, %v", replay, err)
	}
	input.Status = domain.OrderStatusCompleted
	if _, err := r.UpdateOrder(ctx, input); !errors.Is(err, orderservice.ErrOrderVersionConflict) {
		t.Fatalf("stale version error = %v", err)
	}
	input.Status, input.ExpectedVersion = domain.OrderStatusCancelled, 2
	if _, err := r.UpdateOrder(ctx, input); !errors.Is(err, orderservice.ErrCancelTooEarly) {
		t.Fatalf("early cancel error = %v", err)
	}
	input.Status = domain.OrderStatusCompleted
	completed, err := r.UpdateOrder(ctx, input)
	if err != nil {
		t.Fatal(err)
	}
	if completed.Version != 3 || completed.CompletedAt == nil || !completed.ReadyAt.Equal(*ready.ReadyAt) || !reflect.DeepEqual(completed.Items, ready.Items) {
		t.Fatalf("completed = %+v", completed)
	}
	replay, err = r.UpdateOrder(ctx, input)
	if err != nil || !reflect.DeepEqual(replay, completed) {
		t.Fatalf("completed replay = %+v, %v", replay, err)
	}
	input.Status, input.ExpectedVersion = domain.OrderStatusReady, 3
	if _, err := r.UpdateOrder(ctx, input); !errors.Is(err, orderservice.ErrOrderStateConflict) {
		t.Fatalf("terminal transition error = %v", err)
	}
}

func TestUpdateOrderPostgresAuthorization(t *testing.T) {
	ctx, r, input := orderUpdateFixture(t)
	for _, test := range []struct {
		name   string
		mutate func(*orderservice.UpdateRepositoryInput)
		want   error
	}{
		{"missing store", func(i *orderservice.UpdateRepositoryInput) { i.StoreID = uuid.New() }, services.ErrNotFound},
		{"nonmember", func(i *orderservice.UpdateRepositoryInput) { i.AccountID = uuid.New() }, services.ErrForbidden},
		{"missing order", func(i *orderservice.UpdateRepositoryInput) { i.OrderID = uuid.New() }, services.ErrNotFound},
	} {
		t.Run(test.name, func(t *testing.T) {
			i := input
			test.mutate(&i)
			if _, err := r.UpdateOrder(ctx, i); !errors.Is(err, test.want) {
				t.Fatalf("error = %v, want %v", err, test.want)
			}
		})
	}
	otherStore := uuid.New()
	execOrderSQL(t, ctx, r.pool, `INSERT INTO stores (id,name,room,description,image_object_key) VALUES ($1,'other','test','','test')`, otherStore)
	execOrderSQL(t, ctx, r.pool, `INSERT INTO store_members (store_id,account_id,role) VALUES ($1,$2,'manager')`, otherStore, input.AccountID)
	wrongStore := input
	wrongStore.StoreID = otherStore
	if _, err := r.UpdateOrder(ctx, wrongStore); !errors.Is(err, services.ErrNotFound) {
		t.Fatalf("wrong store error = %v", err)
	}
	// グローバルAdminであっても、店舗への所属がなければ更新できない。
	execOrderSQL(t, ctx, r.pool, `UPDATE accounts SET role='admin' WHERE id=$1`, input.AccountID)
	execOrderSQL(t, ctx, r.pool, `DELETE FROM store_members WHERE store_id=$1 AND account_id=$2`, input.StoreID, input.AccountID)
	if _, err := r.UpdateOrder(ctx, input); !errors.Is(err, services.ErrForbidden) {
		t.Fatalf("admin nonmember error = %v", err)
	}
	row, err := r.queries.LockOrderByIDAndStoreID(ctx, sqlc.LockOrderByIDAndStoreIDParams{OrderID: input.OrderID, StoreID: input.StoreID})
	if err != nil || row.Version != 1 || row.Status != sqlc.OrderStatusPending {
		t.Fatalf("denied requests changed order: %+v, %v", row, err)
	}
}

func TestUpdateOrderPostgresConcurrentTransitions(t *testing.T) {
	ctx, r, input := orderUpdateFixture(t)
	managerID := uuid.New()
	execOrderSQL(t, ctx, r.pool, `INSERT INTO accounts (id,google_sub,email) VALUES ($1,'manager','manager@example.com')`, managerID)
	execOrderSQL(t, ctx, r.pool, `INSERT INTO store_members (store_id,account_id,role) VALUES ($1,$2,'manager')`, input.StoreID, managerID)
	execOrderSQL(t, ctx, r.pool, `UPDATE orders SET status='ready',version=2,ready_at=now()-interval '16 minutes',created_at=now()-interval '17 minutes',updated_at=now()-interval '16 minutes' WHERE id=$1`, input.OrderID)
	input.ExpectedVersion = 2
	start := make(chan struct{})
	errorsCh := make(chan error, 2)
	for _, status := range []domain.OrderStatus{domain.OrderStatusCompleted, domain.OrderStatusCancelled} {
		i := input
		i.Status = status
		if status == domain.OrderStatusCancelled {
			i.AccountID = managerID
		}
		go func() { <-start; _, err := r.UpdateOrder(ctx, i); errorsCh <- err }()
	}
	close(start)
	successes, conflicts := 0, 0
	for range 2 {
		err := <-errorsCh
		if err == nil {
			successes++
		} else if errors.Is(err, orderservice.ErrOrderVersionConflict) {
			conflicts++
		} else {
			t.Fatalf("update error = %v", err)
		}
	}
	if successes != 1 || conflicts != 1 {
		t.Fatalf("successes = %d, conflicts = %d", successes, conflicts)
	}
	row, err := r.queries.LockOrderByIDAndStoreID(ctx, sqlc.LockOrderByIDAndStoreIDParams{OrderID: input.OrderID, StoreID: input.StoreID})
	if err != nil || row.Version != 3 || (row.Status != sqlc.OrderStatusCompleted && row.Status != sqlc.OrderStatusCancelled) {
		t.Fatalf("concurrent result = %+v, %v", row, err)
	}
}

func TestUpdateOrderPostgresClockAfterLock(t *testing.T) {
	ctx, r, input := orderUpdateFixture(t)
	execOrderSQL(t, ctx, r.pool, `UPDATE orders SET status='ready',version=2,ready_at=now()-interval '15 minutes'+interval '1 second',created_at=now()-interval '16 minutes',updated_at=now()-interval '15 minutes'+interval '1 second' WHERE id=$1`, input.OrderID)
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback(context.Background())
	if _, err := r.queries.WithTx(tx).LockOrderByIDAndStoreID(ctx, sqlc.LockOrderByIDAndStoreIDParams{OrderID: input.OrderID, StoreID: input.StoreID}); err != nil {
		t.Fatal(err)
	}
	input.Status, input.ExpectedVersion = domain.OrderStatusCancelled, 2
	result := make(chan error, 1)
	go func() { _, err := r.UpdateOrder(ctx, input); result <- err }()
	// 更新側が注文のロックで待機していることを確認してから、15分の境界を越える。
	for {
		var waiting bool
		err := r.pool.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM pg_stat_activity WHERE application_name=current_setting('application_name') AND wait_event_type='Lock' AND query LIKE '%LockOrderByIDAndStoreID%')`).Scan(&waiting)
		if err != nil {
			t.Fatal(err)
		}
		if waiting {
			break
		}
		select {
		case err := <-result:
			t.Fatalf("update did not wait: %v", err)
		case <-ctx.Done():
			t.Fatal(ctx.Err())
		case <-time.After(5 * time.Millisecond):
		}
	}
	if _, err := tx.Exec(ctx, `SELECT pg_sleep(GREATEST(0, EXTRACT(EPOCH FROM (ready_at+interval '15 minutes'-clock_timestamp())))+0.01) FROM orders WHERE id=$1`, input.OrderID); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(ctx); err != nil {
		t.Fatal(err)
	}
	if err := <-result; err != nil {
		t.Fatalf("cancel after lock wait: %v", err)
	}
}
