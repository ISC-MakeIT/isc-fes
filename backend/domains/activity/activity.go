// Package activity defines the business change history independently of HTTP and database transactions.
package activity

import (
	"reflect"
	"slices"
	"strings"
	"time"

	"github.com/google/uuid"
)

type EventType string

const (
	OrderCreated             EventType = "order.created"
	OrderStatusChanged       EventType = "order.status_changed"
	MenuCreated              EventType = "menu.created"
	MenuUpdated              EventType = "menu.updated"
	MenuDeleted              EventType = "menu.deleted"
	ToppingCreated           EventType = "topping.created"
	ToppingUpdated           EventType = "topping.updated"
	ToppingDeleted           EventType = "topping.deleted"
	StoreCreated             EventType = "store.created"
	StoreReviewStatusChanged EventType = "store.review_status_changed"
	StoreUpdated             EventType = "store.updated"
)

func (t EventType) SubjectType() string {
	subject, _, _ := strings.Cut(string(t), ".")
	return subject
}

// Both IDs may be present when an authenticated account places an order as a guest.
type Actor struct {
	AccountID *uuid.UUID
	GuestID   *uuid.UUID
}

func AccountActor(id uuid.UUID) Actor { return Actor{AccountID: &id} }

type Snapshot map[string]any

type Payload struct {
	Before  Snapshot       `json:"before"`
	After   Snapshot       `json:"after"`
	Context map[string]any `json:"context,omitempty"`
}

type Event struct {
	Type      EventType
	StoreID   uuid.UUID
	SubjectID uuid.UUID
	Actor     Actor
	// A zero time uses the database clock at insertion. Order transitions supply their exact update time.
	At      time.Time
	Payload Payload
}

// Diff compares business snapshots; callers exclude technical timestamps and normalize ID sets.
func Diff(before, after Snapshot) (Payload, bool) {
	previous, next := Snapshot{}, Snapshot{}
	for key, old := range before {
		value, exists := after[key]
		if !exists || !reflect.DeepEqual(old, value) {
			previous[key], next[key] = old, value
		}
	}
	for key, value := range after {
		if _, exists := before[key]; !exists {
			previous[key], next[key] = nil, value
		}
	}
	return Payload{Before: previous, After: next}, len(previous) > 0
}

// UUIDSet returns a sorted, unique, non-nil copy, without modifying repository data.
func UUIDSet(ids []uuid.UUID) []uuid.UUID {
	result := append([]uuid.UUID{}, ids...)
	slices.SortFunc(result, func(a, b uuid.UUID) int { return strings.Compare(a.String(), b.String()) })
	return slices.Compact(result)
}
