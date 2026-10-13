// Package activity records history through the caller's transaction-bound queries.
package activity

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	domain "github.com/isc-makeit/isc-fes/backend/domains/activity"
	"github.com/jackc/pgx/v5/pgtype"
)

// Record does not start or commit a transaction. An error must abort the business mutation.
func Record(ctx context.Context, qtx *sqlc.Queries, event domain.Event) error {
	if event.StoreID == uuid.Nil || event.SubjectID == uuid.Nil ||
		(event.Actor.AccountID == nil && event.Actor.GuestID == nil) ||
		(event.Actor.AccountID != nil && *event.Actor.AccountID == uuid.Nil) ||
		(event.Actor.GuestID != nil && *event.Actor.GuestID == uuid.Nil) {
		return fmt.Errorf("invalid activity identity")
	}
	payload, err := json.Marshal(event.Payload)
	if err != nil {
		return fmt.Errorf("encode activity payload: %w", err)
	}
	err = qtx.InsertActivityLog(ctx, sqlc.InsertActivityLogParams{
		OccurredAt: pgtype.Timestamptz{Time: event.At, Valid: !event.At.IsZero()},
		EventType:  string(event.Type), StoreID: event.StoreID,
		SubjectType: event.Type.SubjectType(), SubjectID: event.SubjectID,
		ActorAccountID: event.Actor.AccountID, ActorGuestID: event.Actor.GuestID, Payload: payload,
	})
	if err != nil {
		return fmt.Errorf("insert %s activity: %w", event.Type, err)
	}
	return nil
}

func MenuSnapshot(ctx context.Context, qtx *sqlc.Queries, row sqlc.Menu) (domain.Snapshot, error) {
	ids, err := qtx.GetActivityMenuToppingIDs(ctx, sqlc.GetActivityMenuToppingIDsParams{StoreID: row.StoreID, MenuID: row.ID})
	if err != nil {
		return nil, fmt.Errorf("get activity menu toppings: %w", err)
	}
	return domain.Snapshot{
		"name": row.Name, "description": row.Description, "unit_price": row.UnitPrice,
		"image_object_key": row.ImageObjectKey, "sold_out": row.SoldOut,
		"topping_ids": domain.UUIDSet(ids),
	}, nil
}

func ToppingSnapshot(row sqlc.Topping) domain.Snapshot {
	return domain.Snapshot{"name": row.Name, "unit_price": row.UnitPrice, "sold_out": row.SoldOut}
}

func StoreSnapshot(ctx context.Context, qtx *sqlc.Queries, row sqlc.Store) (domain.Snapshot, error) {
	ids, err := qtx.GetActivityStoreAllergenIDs(ctx, row.ID)
	if err != nil {
		return nil, fmt.Errorf("get activity store allergens: %w", err)
	}
	var closedAt any
	if row.ClosedAt.Valid {
		closedAt = row.ClosedAt.Time
	}
	return domain.Snapshot{
		"name": row.Name, "room": row.Room, "description": row.Description,
		"image_object_key": row.ImageObjectKey, "review_status": row.ReviewStatus,
		"order_enabled": row.OrderEnabled, "closed_at": closedAt,
		"congestion_level": row.CongestionLevel, "allergen_ids": domain.UUIDSet(ids),
	}, nil
}
