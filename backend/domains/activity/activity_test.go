package activity

import (
	"encoding/json"
	"reflect"
	"testing"

	"github.com/google/uuid"
)

func TestDiff(t *testing.T) {
	a, b := uuid.New(), uuid.New()
	tests := []struct {
		name          string
		before, after Snapshot
		want          Payload
		changed       bool
	}{
		{name: "same values and reordered set", before: Snapshot{"unit_price": int32(500), "ids": UUIDSet([]uuid.UUID{a, b})}, after: Snapshot{"unit_price": int32(500), "ids": UUIDSet([]uuid.UUID{b, a})}, want: Payload{Before: Snapshot{}, After: Snapshot{}}},
		{name: "zero false and null are changes", before: Snapshot{"price": int32(500), "sold_out": true, "closed_at": "timestamp"}, after: Snapshot{"price": int32(0), "sold_out": false, "closed_at": nil}, changed: true, want: Payload{Before: Snapshot{"price": int32(500), "sold_out": true, "closed_at": "timestamp"}, After: Snapshot{"price": int32(0), "sold_out": false, "closed_at": nil}}},
		{name: "only changed fields", before: Snapshot{"name": "curry", "price": 500}, after: Snapshot{"name": "curry", "price": 600}, changed: true, want: Payload{Before: Snapshot{"price": 500}, After: Snapshot{"price": 600}}},
		{name: "empty set equivalent to nil set", before: Snapshot{"ids": UUIDSet(nil)}, after: Snapshot{"ids": UUIDSet([]uuid.UUID{})}, want: Payload{Before: Snapshot{}, After: Snapshot{}}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, changed := Diff(test.before, test.after)
			if changed != test.changed || !reflect.DeepEqual(got, test.want) {
				t.Fatalf("Diff() = %#v, %v; want %#v, %v", got, changed, test.want, test.changed)
			}
		})
	}
}

func TestUUIDSetCopiesAndDeduplicates(t *testing.T) {
	a := uuid.MustParse("00000000-0000-0000-0000-000000000001")
	b := uuid.MustParse("00000000-0000-0000-0000-000000000002")
	input := []uuid.UUID{b, a, b}
	got := UUIDSet(input)
	if !reflect.DeepEqual(got, []uuid.UUID{a, b}) || !reflect.DeepEqual(input, []uuid.UUID{b, a, b}) {
		t.Fatalf("set=%v input=%v", got, input)
	}
}

func TestPayloadLifecycleNulls(t *testing.T) {
	for _, payload := range []Payload{{After: Snapshot{"name": "menu"}}, {Before: Snapshot{"name": "menu"}}} {
		data, err := json.Marshal(payload)
		if err != nil {
			t.Fatal(err)
		}
		var decoded map[string]any
		if err := json.Unmarshal(data, &decoded); err != nil {
			t.Fatal(err)
		}
		if _, ok := decoded["before"]; !ok {
			t.Fatal("missing before")
		}
		if _, ok := decoded["after"]; !ok {
			t.Fatal("missing after")
		}
		if _, ok := decoded["context"]; ok {
			t.Fatal("empty context should be omitted")
		}
		if payload.Before == nil && decoded["before"] != nil {
			t.Fatal("create before must be null")
		}
		if payload.After == nil && decoded["after"] != nil {
			t.Fatal("delete after must be null")
		}
	}
}
