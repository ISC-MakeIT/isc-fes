package routers

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/repositories"
	"github.com/isc-makeit/isc-fes/backend/repositories/allergens"
	"github.com/isc-makeit/isc-fes/backend/repositories/imageurl"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// 既存DBのデータには触れず、テスト専用schemaで本番のSQL・Service・Routerを検証する。
func storeRankingPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("TEST_STORE_DATABASE_URL")
	if dsn == "" {
		dsn = os.Getenv("TEST_ORDER_DATABASE_URL")
	}
	if dsn == "" {
		t.Skip("TEST_STORE_DATABASE_URL or TEST_ORDER_DATABASE_URL is required for PostgreSQL integration tests")
	}
	ctx, cancel := context.WithTimeout(t.Context(), 20*time.Second)
	defer cancel()
	admin, err := pgx.Connect(ctx, dsn)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { admin.Close(context.Background()) })
	schema := pgx.Identifier{"store_ranking_" + uuid.New().String()}.Sanitize()
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
	paths, err := filepath.Glob("../db/migrations/*.up.sql")
	if err != nil || len(paths) == 0 {
		t.Fatalf("find migrations: %v", err)
	}
	for _, path := range paths {
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
	return pool
}

func TestGetStoreRankingPostgres(t *testing.T) {
	gin.SetMode(gin.TestMode)
	pool := storeRankingPool(t)
	queries := sqlc.New(pool)
	images, err := imageurl.NewCloudFrontImageURLGenerator("https://images.example.com")
	if err != nil {
		t.Fatal(err)
	}
	auth := &stubCurrentAccountLoader{err: services.ErrUnauthenticated}
	guest := &stubGuestResolver{}
	server := &Server{
		accountService: auth,
		guestResolver:  guest,
		store: services.NewStoreService(
			repositories.NewStoreRepository(queries, pool), nil,
			allergens.NewAllergenRepository(queries), nil, images, nil,
		),
	}
	router, err := NewRouter(server, []string{"https://frontend.example.com"})
	if err != nil {
		t.Fatal(err)
	}
	swagger, err := GetSwagger()
	if err != nil {
		t.Fatal(err)
	}
	if err := swagger.Validate(t.Context()); err != nil {
		t.Fatal(err)
	}
	wantStores := make(map[uuid.UUID]Store)
	checkRanking := func(t *testing.T, ids ...uuid.UUID) {
		t.Helper()
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/stores/ranking", nil))
		if response.Code != http.StatusOK {
			t.Fatalf("status = %d: %s", response.Code, response.Body)
		}
		if auth.calls != 0 || guest.calls != 0 || len(response.Result().Cookies()) != 0 {
			t.Fatal("public ranking must not require or create a session")
		}
		var payload any
		if err := json.Unmarshal(response.Body.Bytes(), &payload); err != nil {
			t.Fatal(err)
		}
		if err := swagger.Components.Schemas["GetStoreRankingResponse"].Value.VisitJSON(payload); err != nil {
			t.Fatalf("response does not match allOf schema: %v", err)
		}
		var ranking GetStoreRankingResponse
		if err := json.Unmarshal(response.Body.Bytes(), &ranking); err != nil {
			t.Fatal(err)
		}
		if ranking.Total != len(ids) || ranking.Data == nil || len(ranking.Data) != len(ids) {
			t.Fatalf("ranking = %s, want %d stores", response.Body, len(ids))
		}
		items := payload.(map[string]any)["data"].([]any)
		for i, id := range ids {
			if ranking.Data[i].Id != id || ranking.Data[i].Place != i+1 {
				t.Errorf("item %d = %+v, want store %s at place %d", i, ranking.Data[i], id, i+1)
			}
			// Storeの全フィールドを維持し、place以外（金額など）を追加しない。
			fields := items[i].(map[string]any)
			delete(fields, "place")
			encoded, err := json.Marshal(wantStores[id])
			if err != nil {
				t.Fatal(err)
			}
			var want map[string]any
			if err := json.Unmarshal(encoded, &want); err != nil {
				t.Fatal(err)
			}
			// PostgreSQLの時刻は同じ瞬間でも異なるタイムゾーン表記で返る。
			for _, values := range []map[string]any{fields, want} {
				if value, ok := values["closedAt"].(string); ok {
					at, err := time.Parse(time.RFC3339Nano, value)
					if err != nil {
						t.Fatal(err)
					}
					values["closedAt"] = at.UTC().Format(time.RFC3339Nano)
				}
			}
			if !reflect.DeepEqual(fields, want) {
				t.Errorf("store fields = %v, want %v", fields, want)
			}
		}
	}
	t.Run("no approved stores returns an empty array", func(t *testing.T) { checkRanking(t) })

	execSQL := func(query string, args ...any) {
		t.Helper()
		if _, err := pool.Exec(t.Context(), query, args...); err != nil {
			t.Fatal(err)
		}
	}
	execSQL(`INSERT INTO rooms (name,sort_order) VALUES ('ranking room',0)`)
	guestID := uuid.New()
	execSQL(`INSERT INTO guests (id) VALUES ($1)`, guestID)
	ids := []uuid.UUID{
		uuid.MustParse("00000000-0000-0000-0000-000000000001"),
		uuid.MustParse("00000000-0000-0000-0000-000000000002"),
		uuid.MustParse("00000000-0000-0000-0000-000000000003"),
		uuid.MustParse("00000000-0000-0000-0000-000000000004"),
	}
	closedAt := time.Now().UTC().Truncate(time.Microsecond)
	// ID順と逆に登録し、作成順に依存しないことも確認する。
	for i := len(ids) - 1; i >= 0; i-- {
		id := ids[i]
		store := Store{
			Id: id, Name: "current store " + id.String(), Room: "ranking room",
			Description: "ranking description", ImageUrl: "https://images.example.com/images/" + id.String(),
			ReviewStatus: StoreReviewStatusApproved, Allergens: []Allergen{},
			CongestionLevel: StoreCongestionLevel(i%3 + 1), OrderEnabled: i != 2,
		}
		if i == 2 {
			store.ClosedAt = &closedAt
		}
		execSQL(`INSERT INTO stores (id,name,room,description,image_object_key,review_status,closed_at,congestion_level,order_enabled)
			VALUES ($1,$2,$3,$4,$5,'approved',$6,$7,$8)`, id, store.Name, store.Room, store.Description,
			entities.NewStoreImageObjectKey(id).String(), store.ClosedAt, int(store.CongestionLevel), store.OrderEnabled)
		wantStores[id] = store
	}
	allergenID := uuid.New()
	execSQL(`INSERT INTO allergens (id,name) VALUES ($1,'ranking allergen')`, allergenID)
	execSQL(`INSERT INTO store_allergens (store_id,allergen_id) VALUES ($1,$2)`, ids[2], allergenID)
	store := wantStores[ids[2]]
	store.Allergens = []Allergen{{Id: allergenID, Name: "ranking allergen"}}
	wantStores[ids[2]] = store
	t.Run("zero sales ties use store ID and limit to three", func(t *testing.T) {
		checkRanking(t, ids[0], ids[1], ids[2])
	})

	addOrder := func(storeID uuid.UUID, status string, amount int64, created time.Time) {
		t.Helper()
		cartID := uuid.New()
		execSQL(`INSERT INTO carts (id,store_id,guest_id) VALUES ($1,$2,$3)
			ON CONFLICT (guest_id,store_id) DO UPDATE SET version=carts.version+1`, cartID, storeID, guestID)
		// 同じGuest・店舗のカートを再利用し、注文スナップショットは別versionとする。
		execSQL(`INSERT INTO orders (store_id,guest_id,status,total_amount,display_number,origin_cart_id,origin_cart_version,
			store_name,room_name,ready_at,completed_at,cancelled_at,created_at,updated_at)
			SELECT $1,$2,$3::order_status,$4,version,id,version,'old store name','old room',
			CASE WHEN $3 <> 'pending' THEN $5::timestamptz END,
			CASE WHEN $3 = 'completed' THEN $5::timestamptz END,
			CASE WHEN $3 = 'cancelled' THEN $5::timestamptz END,$5,$5
			FROM carts WHERE store_id=$1 AND guest_id=$2`, storeID, guestID, status, amount, created)
	}
	old := closedAt.AddDate(-1, 0, 0)
	for range 5 {
		addOrder(ids[0], "completed", 100, old)
	}
	addOrder(ids[1], "completed", 600, closedAt)
	addOrder(ids[1], "completed", 400, old)
	addOrder(ids[2], "completed", 1000, old)
	addOrder(ids[3], "completed", 1000, closedAt)
	for _, status := range []string{"pending", "ready", "cancelled"} {
		addOrder(ids[0], status, 1_000_000, closedAt)
	}
	for _, status := range []string{"pending", "rejected"} {
		id := uuid.New()
		execSQL(`INSERT INTO stores (id,name,room,description,image_object_key,review_status)
			VALUES ($1,'unapproved','ranking room','','test',$2)`, id, status)
		addOrder(id, "completed", 1_000_000, closedAt)
	}
	t.Run("rank by completed revenue across all time including closed stores", func(t *testing.T) {
		checkRanking(t, ids[1], ids[2], ids[3])
	})
	execSQL(`DELETE FROM orders`)
	addOrder(ids[3], "completed", 1000, old)
	addOrder(ids[0], "cancelled", 1_000_000, closedAt)
	t.Run("zero sales fill remaining places", func(t *testing.T) {
		checkRanking(t, ids[3], ids[0], ids[1])
	})
	execSQL(`UPDATE stores SET review_status='rejected' WHERE id=$1 OR id=$2`, ids[1], ids[3])
	t.Run("fewer than three approved stores", func(t *testing.T) {
		checkRanking(t, ids[0], ids[2])
	})
	pool.Close()
	t.Run("database failure returns 500", func(t *testing.T) {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/stores/ranking", nil))
		if response.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d: %s", response.Code, response.Body)
		}
	})
}
