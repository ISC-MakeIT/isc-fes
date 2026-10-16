package activity_test

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	menuentity "github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/isc-makeit/isc-fes/backend/repositories"
	orderrepo "github.com/isc-makeit/isc-fes/backend/repositories/orders"
	menurepo "github.com/isc-makeit/isc-fes/backend/repositories/stores/menus"
	toppingrepo "github.com/isc-makeit/isc-fes/backend/repositories/stores/toppings"
	orderservice "github.com/isc-makeit/isc-fes/backend/services/orders"
	menuservice "github.com/isc-makeit/isc-fes/backend/services/store/menus"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type fixture struct {
	ctx                context.Context
	admin              *pgx.Conn
	pool               *pgxpool.Pool
	q                  *sqlc.Queries
	storeID, accountID uuid.UUID
	stores             *repositories.StoreRepository
	menus              *menurepo.MenuRepository
	toppings           *toppingrepo.ToppingsRepository
	orders             *orderrepo.OrderRepository
}

// Only a random test schema is changed; the application's public schema is never migrated.
func newFixture(t *testing.T, includeActivity bool) *fixture {
	t.Helper()
	dsn := os.Getenv("TEST_ACTIVITY_DATABASE_URL")
	if dsn == "" {
		dsn = os.Getenv("TEST_ORDER_DATABASE_URL")
	}
	if dsn == "" {
		t.Skip("TEST_ACTIVITY_DATABASE_URL is required for PostgreSQL integration tests")
	}
	ctx, cancel := context.WithTimeout(t.Context(), 30*time.Second)
	t.Cleanup(cancel)
	admin, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { admin.Close(context.Background()) })
	schema := pgx.Identifier{"activity_" + uuid.New().String()}.Sanitize()
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+schema); err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		cleanupCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if _, err := admin.Exec(cleanupCtx, "DROP SCHEMA "+schema+" CASCADE"); err != nil {
			t.Error(err)
		}
	})
	if _, err := admin.Exec(ctx, "SET search_path TO "+schema); err != nil {
		t.Fatal(err)
	}
	paths, err := filepath.Glob("../../db/migrations/*.up.sql")
	if err != nil || len(paths) == 0 {
		t.Fatalf("find migrations: %v", err)
	}
	for _, path := range paths {
		if !includeActivity && strings.HasPrefix(filepath.Base(path), "000025_") {
			continue
		}
		data, err := os.ReadFile(path)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := admin.Exec(ctx, string(data)); err != nil {
			t.Fatalf("migrate %s: %v", path, err)
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
	q := sqlc.New(pool)
	f := &fixture{ctx: ctx, admin: admin, pool: pool, q: q, storeID: uuid.New(), accountID: uuid.New(),
		stores: repositories.NewStoreRepository(q, pool), menus: menurepo.NewMenuRepository(q, pool),
		toppings: toppingrepo.NewToppingsRepository(q, pool), orders: orderrepo.NewOrderRepository(q, pool)}
	f.exec(t, `INSERT INTO rooms (name,sort_order) VALUES ('activity-room',0)`)
	f.exec(t, `INSERT INTO accounts (id,google_sub,email) VALUES ($1,$2,'test@example.com')`, f.accountID, f.accountID.String())
	f.exec(t, `INSERT INTO stores (id,name,room,description,image_object_key,review_status,order_enabled)
        VALUES ($1,'store','activity-room','description','image','approved',true)`, f.storeID)
	f.exec(t, `INSERT INTO store_members (store_id,account_id,role) VALUES ($1,$2,'manager')`, f.storeID, f.accountID)
	return f
}

func (f *fixture) exec(t *testing.T, query string, args ...any) {
	t.Helper()
	if _, err := f.pool.Exec(f.ctx, query, args...); err != nil {
		t.Fatal(err)
	}
}

func (f *fixture) count(t *testing.T, query string, args ...any) int {
	t.Helper()
	var n int
	if err := f.pool.QueryRow(f.ctx, query, args...).Scan(&n); err != nil {
		t.Fatal(err)
	}
	return n
}

func (f *fixture) logCount(t *testing.T) int { return f.count(t, `SELECT count(*) FROM activity_log`) }

type loggedEvent struct {
	at                     time.Time
	accountID, guestID     *uuid.UUID
	before, after, context map[string]any
}

func (f *fixture) lastLog(t *testing.T, eventType string, id uuid.UUID) loggedEvent {
	t.Helper()
	var event loggedEvent
	var data []byte
	if err := f.pool.QueryRow(f.ctx, `SELECT occurred_at,actor_account_id,actor_guest_id,payload
        FROM activity_log WHERE event_type=$1 AND subject_id=$2 ORDER BY occurred_at DESC,id DESC LIMIT 1`, eventType, id).
		Scan(&event.at, &event.accountID, &event.guestID, &data); err != nil {
		t.Fatal(err)
	}
	var payload struct{ Before, After, Context map[string]any }
	if err := json.Unmarshal(data, &payload); err != nil {
		t.Fatal(err)
	}
	event.before, event.after, event.context = payload.Before, payload.After, payload.Context
	return event
}

func assertJSON(t *testing.T, got any, want any) {
	t.Helper()
	encoded, err := json.Marshal(want)
	if err != nil {
		t.Fatal(err)
	}
	var normalized any
	if err := json.Unmarshal(encoded, &normalized); err != nil {
		t.Fatal(err)
	}
	encoded, err = json.Marshal(got)
	if err != nil {
		t.Fatal(err)
	}
	var actual any
	if err := json.Unmarshal(encoded, &actual); err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(actual, normalized) {
		t.Fatalf("got %s; want %v", encoded, normalized)
	}
}

func (f *fixture) createMenu(t *testing.T, toppingIDs ...uuid.UUID) uuid.UUID {
	t.Helper()
	id := uuid.New()
	_, err := f.menus.CreateMenuWithToppings(f.ctx, menuservice.CreateMenuRepositoryInput{
		ID: id, StoreID: f.storeID, AccountID: f.accountID, Name: "menu", Description: "description", UnitPrice: 500,
		ImageObjectKey: menuentity.NewMenuImageObjectKey(uuid.New()), ToppingIds: toppingIDs,
	})
	if err != nil {
		t.Fatal(err)
	}
	return id
}

func (f *fixture) seedCart(t *testing.T) orderservice.CreateRepositoryInput {
	t.Helper()
	menuID, guestID, cartID := uuid.New(), uuid.New(), uuid.New()
	f.exec(t, `INSERT INTO menus (id,store_id,name,description,unit_price,image_object_key) VALUES ($1,$2,'menu','',500,'image')`, menuID, f.storeID)
	f.exec(t, `INSERT INTO guests (id,created_at) VALUES ($1,now()-interval '1 day')`, guestID)
	f.exec(t, `INSERT INTO carts (id,guest_id,store_id) VALUES ($1,$2,$3)`, cartID, guestID, f.storeID)
	f.exec(t, `INSERT INTO cart_items (cart_id,menu_id,store_id,quantity) VALUES ($1,$2,$3,1)`, cartID, menuID, f.storeID)
	return orderservice.CreateRepositoryInput{CreateInput: orderservice.CreateInput{StoreID: f.storeID, ExpectedCartVersion: 1}, GuestID: guestID, AccountID: &f.accountID}
}
