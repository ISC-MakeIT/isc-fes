package activity_test

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	domain "github.com/isc-makeit/isc-fes/backend/domains/activity"
	"github.com/jackc/pgx/v5/pgtype"
)

func (f *fixture) observe(t *testing.T, at time.Time, eventType string, subjectID uuid.UUID, payload domain.Payload) {
	t.Helper()
	data, err := json.Marshal(payload)
	if err != nil {
		t.Fatal(err)
	}
	var actor *uuid.UUID
	if !strings.HasSuffix(eventType, ".baseline") {
		actor = &f.accountID
	}
	subject, _, _ := strings.Cut(eventType, ".")
	if err := f.q.InsertActivityLog(f.ctx, sqlc.InsertActivityLogParams{
		OccurredAt: pgtype.Timestamptz{Time: at, Valid: true}, EventType: eventType,
		StoreID: f.storeID, SubjectType: subject, SubjectID: subjectID, ActorAccountID: actor, Payload: data,
	}); err != nil {
		t.Fatal(err)
	}
}

func (f *fixture) analyze(t *testing.T, filename string, args ...any) []map[string]any {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("../../db/analysis", filename))
	if err != nil {
		t.Fatal(err)
	}
	query := strings.NewReplacer(":'start_at'", "$1", ":'end_at'", "$2", ":'account_id'", "$3", ":'guest_id'", "$4").Replace(string(data))
	query = strings.TrimSuffix(strings.TrimSpace(query), ";")
	rows, err := f.pool.Query(f.ctx, "SELECT row_to_json(result) FROM ("+query+") result", args...)
	if err != nil {
		t.Fatal(err)
	}
	defer rows.Close()
	result := []map[string]any{}
	for rows.Next() {
		var encoded []byte
		if err := rows.Scan(&encoded); err != nil {
			t.Fatal(err)
		}
		var row map[string]any
		if err := json.Unmarshal(encoded, &row); err != nil {
			t.Fatal(err)
		}
		result = append(result, row)
	}
	if err := rows.Err(); err != nil {
		t.Fatal(err)
	}
	return result
}

func TestActivityPostgresStateIntervals(t *testing.T) {
	f := newFixture(t, true)
	base := time.Date(2026, 10, 12, 15, 0, 0, 0, time.UTC) // October 13 at midnight in Japan.
	at := func(minutes int) time.Time { return base.Add(time.Duration(minutes) * time.Minute) }
	menu, continuous, deleted, late, topping := uuid.New(), uuid.New(), uuid.New(), uuid.New(), uuid.New()
	f.observe(t, at(0), "menu.baseline", menu, domain.Payload{After: domain.Snapshot{"sold_out": true}})
	f.observe(t, at(15), "menu.updated", menu, domain.Payload{Before: domain.Snapshot{"unit_price": 500}, After: domain.Snapshot{"unit_price": 600}})
	f.observe(t, at(20), "menu.updated", menu, domain.Payload{Before: domain.Snapshot{"sold_out": true}, After: domain.Snapshot{"sold_out": false}})
	f.observe(t, at(30), "menu.updated", menu, domain.Payload{Before: domain.Snapshot{"sold_out": false}, After: domain.Snapshot{"sold_out": true}})
	f.observe(t, at(0), "menu.baseline", continuous, domain.Payload{After: domain.Snapshot{"sold_out": true}})
	f.observe(t, at(30), "menu.created", deleted, domain.Payload{After: domain.Snapshot{"sold_out": true}})
	f.observe(t, at(40), "menu.deleted", deleted, domain.Payload{Before: domain.Snapshot{"sold_out": true}})
	f.observe(t, at(30), "menu.baseline", late, domain.Payload{After: domain.Snapshot{"sold_out": true}})
	f.observe(t, at(0), "topping.baseline", topping, domain.Payload{After: domain.Snapshot{"sold_out": true}})
	f.observe(t, at(20), "topping.deleted", topping, domain.Payload{Before: domain.Snapshot{"sold_out": true}})
	f.observe(t, at(0), "store.baseline", f.storeID, domain.Payload{After: domain.Snapshot{"closed_at": at(0), "order_enabled": false}})
	f.observe(t, at(20), "store.updated", f.storeID, domain.Payload{Before: domain.Snapshot{"order_enabled": false}, After: domain.Snapshot{"order_enabled": true}})
	f.observe(t, at(40), "store.updated", f.storeID, domain.Payload{Before: domain.Snapshot{"closed_at": at(0)}, After: domain.Snapshot{"closed_at": nil}})
	rows := f.analyze(t, "state_intervals.sql", at(10), at(50))
	durations := map[string]float64{}
	for _, row := range rows {
		key := row["subject_id"].(string) + "." + row["metric"].(string)
		durations[key] += row["duration_seconds"].(float64)
		if !strings.HasPrefix(row["start_jst"].(string), "2026-10-13T00:") {
			t.Fatalf("wrong Japanese local date: %v", row)
		}
	}
	want := map[string]float64{
		menu.String() + ".sold_out": 1800, continuous.String() + ".sold_out": 2400,
		deleted.String() + ".sold_out": 600, late.String() + ".sold_out": 1200, topping.String() + ".sold_out": 600,
		f.storeID.String() + ".order_disabled": 600, f.storeID.String() + ".closed": 1800,
	}
	if len(rows) != 8 || !reflect.DeepEqual(durations, want) {
		t.Fatalf("intervals=%v durations=%v want=%v", rows, durations, want)
	}
	// No state is inferred before the first baseline/creation, including a baseline inside the period.
	rows = f.analyze(t, "state_intervals.sql", at(-10), at(50))
	for _, row := range rows {
		if row["subject_id"] == late.String() && row["duration_seconds"] != float64(1200) {
			t.Fatalf("state inferred before baseline: %v", row)
		}
	}
	if got := f.analyze(t, "state_intervals.sql", at(50), at(10)); len(got) != 0 {
		t.Fatalf("reversed bounds returned intervals: %v", got)
	}
}

func TestActivityPostgresOtherAnalysisSQL(t *testing.T) {
	f := newFixture(t, true)
	base := time.Date(2026, 10, 12, 15, 0, 0, 0, time.UTC)
	f.observe(t, base, "menu.baseline", uuid.New(), domain.Payload{After: domain.Snapshot{"sold_out": false}})
	f.observe(t, base.Add(time.Minute), "menu.updated", uuid.New(), domain.Payload{Before: domain.Snapshot{"unit_price": 500}, After: domain.Snapshot{"unit_price": 600}})
	history := f.analyze(t, "actor_history.sql", base, base.Add(time.Hour), f.accountID.String(), "")
	if len(history) != 1 || history[0]["event_type"] != "menu.updated" {
		t.Fatalf("actor history=%v", history)
	}
	if len(f.analyze(t, "actor_history.sql", base, base.Add(time.Hour), uuid.New().String(), "")) != 0 {
		t.Fatal("actor filter ignored")
	}
	daily := f.analyze(t, "daily_activity.sql", base, base.Add(time.Hour))
	if len(daily) != 1 || daily[0]["date_jst"] != "2026-10-13" || daily[0]["event_count"] != float64(1) {
		t.Fatalf("daily activity=%v", daily)
	}
	input := f.seedCart(t)
	order, err := f.orders.CreateOrder(f.ctx, input)
	if err != nil {
		t.Fatal(err)
	}
	f.exec(t, `UPDATE orders SET status='completed',version=3,created_at=$2,ready_at=$3,completed_at=$4,updated_at=$4 WHERE id=$1`,
		order.Order.ID, base, base.Add(5*time.Minute), base.Add(15*time.Minute))
	timings := f.analyze(t, "order_times.sql", base, base.Add(time.Hour))
	if len(timings) != 1 {
		t.Fatalf("order timings=%v", timings)
	}
	row := timings[0]
	if row["order_date_jst"] != "2026-10-13" || row["preparation_seconds"] != float64(300) || row["pickup_seconds"] != float64(600) || row["total_seconds"] != float64(900) || row["cancellation_wait_seconds"] != nil {
		t.Fatalf("order timings=%v", row)
	}
}
