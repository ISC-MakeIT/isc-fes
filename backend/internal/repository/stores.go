package repository

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/internal/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/internal/domain/entities"
	"github.com/isc-makeit/isc-fes/backend/internal/service"
	"github.com/jackc/pgx/v5/pgxpool"
)

type StoreRepository struct {
	queries *sqlc.Queries
	pool    *pgxpool.Pool
}

func NewStoreRepository(queries *sqlc.Queries, pool *pgxpool.Pool) *StoreRepository {
	return &StoreRepository{
		queries: queries,
		pool:    pool,
	}
}

// 店舗申請を作成する
// 内部的には店舗申請というテーブルはなく、review_status が pending の店舗を作成する
// アカウントにも store_id を紐付け、店舗作成とともに一つのトランザクションで行う
func (r *StoreRepository) CreateStoreApplication(ctx context.Context, input service.CreateStoreApplicationInput) (entities.Store, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return entities.Store{}, err
	}
	defer tx.Rollback(ctx)

	qtx := r.queries.WithTx(tx)

	// アカウントがすでに店舗を持っていないか確認する
	// アカウントへのロックも同時にやる
	account, err := qtx.GetAccountForStoreApplication(ctx, input.AccountID)
	if err != nil {
		return entities.Store{}, err
	}

	if account.StoreID != uuid.Nil {
		return entities.Store{}, service.ErrAccountAlreadyHasStore
	}

	// 店舗を作成する
	store, err := qtx.CreateStore(ctx, sqlc.CreateStoreParams{
		ID:             input.ID,
		Name:           input.Name,
		Room:           input.Room,
		Description:    input.Description,
		ImageObjectKey: input.ImageObjectKey.String(),
	})
	if err != nil {
		return entities.Store{}, err
	}

	// TODO: 状態変更履歴の要件が有効なら、初期 pending イベントを store_status_events へ同じトランザクション内で記録する。

	// アカウントに店舗IDを紐付ける
	err = qtx.AssignStoreToAccount(ctx, sqlc.AssignStoreToAccountParams{
		ID:      input.AccountID,
		StoreID: store.ID,
	})
	if err != nil {
		return entities.Store{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return entities.Store{}, err
	}

	return toStore(store), nil
}

// Converts sqlc.Store to entities.Store
func toStore(dbStore sqlc.Store) entities.Store {
	return entities.Store{
		ID:             dbStore.ID,
		Name:           dbStore.Name,
		Room:           dbStore.Room,
		Description:    dbStore.Description,
		ImageObjectKey: dbStore.ImageObjectKey,
		ReviewStatus:   entities.StoreReviewStatus(dbStore.ReviewStatus),
		SubmittedAt:    dbStore.SubmittedAt.Time,
		CreatedAt:      dbStore.CreatedAt.Time,
		UpdatedAt:      dbStore.UpdatedAt.Time,
	}
}

var _ service.StoreRepository = (*StoreRepository)(nil)
