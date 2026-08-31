package repositories

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/isc-makeit/isc-fes/backend/utils"
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
func (r *StoreRepository) CreateStoreApplication(ctx context.Context, input services.CreateStoreApplicationInput) (entities.Store, error) {
	tx, err := r.pool.Begin(ctx)
	if err != nil {
		return entities.Store{}, err
	}
	defer tx.Rollback(ctx)

	qtx := r.queries.WithTx(tx)

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
	_, err = qtx.CreateStoreMember(ctx, sqlc.CreateStoreMemberParams{
		StoreID:   store.ID,
		AccountID: input.AccountID,
		Role:      sqlc.StoreMemberRoleManager,
	})
	if err != nil {
		return entities.Store{}, err
	}

	if err := tx.Commit(ctx); err != nil {
		return entities.Store{}, err
	}

	return r.toStore(store), nil
}

func (r *StoreRepository) GetStoreApplications(ctx context.Context) ([]entities.Store, error) {
	dbStores, err := r.queries.GetStoreApplications(ctx)
	if err != nil {
		return nil, err
	}

	return utils.Map(dbStores, r.toStore), nil
}

// 承認済みの店舗を返す
func (r *StoreRepository) GetApprovedStores(ctx context.Context) ([]entities.Store, error) {
	dbStores, err := r.queries.GetApprovedStores(ctx)
	if err != nil {
		return nil, err
	}

	return utils.Map(dbStores, r.toStore), nil
}

// 承認済みの店舗を返す
func (r *StoreRepository) GetApprovedStoreByID(ctx context.Context, storeID uuid.UUID) (entities.Store, error) {
	dbStore, err := r.queries.GetApprovedStoreByID(ctx, storeID)
	return r.toStore(dbStore), err
}

func (r *StoreRepository) GetVisibleStoresByAccountID(ctx context.Context, accountID uuid.UUID) ([]entities.Store, error) {
	dbStores, err := r.queries.GetVisibleStoresByAccountID(ctx, accountID)
	if err != nil {
		return nil, err
	}

	return utils.Map(dbStores, r.toStore), nil
}

func (r *StoreRepository) GetStoreByID(ctx context.Context, storeID uuid.UUID) (entities.Store, error) {
	dbStore, err := r.queries.GetStoreByID(ctx, storeID)
	if err != nil {
		return entities.Store{}, err
	}

	return r.toStore(dbStore), nil
}

func (r *StoreRepository) UpdateStoreReviewStatus(ctx context.Context, storeID uuid.UUID, newStatus entities.StoreReviewStatus) error {
	return r.queries.UpdateStoreReviewStatusById(ctx, sqlc.UpdateStoreReviewStatusByIdParams{
		ID:           storeID,
		ReviewStatus: sqlc.StoreReviewStatus(newStatus),
	})
}

// Converts sqlc.Store to entities.Store
func (r *StoreRepository) toStore(dbStore sqlc.Store) entities.Store {
	return entities.Store{
		ID:             dbStore.ID,
		Name:           dbStore.Name,
		Room:           dbStore.Room,
		Description:    dbStore.Description,
		ImageObjectKey: entities.StoreImageObjectKey(dbStore.ImageObjectKey),
		ReviewStatus:   entities.StoreReviewStatus(dbStore.ReviewStatus),
		SubmittedAt:    dbStore.SubmittedAt.Time,
		CreatedAt:      dbStore.CreatedAt.Time,
		UpdatedAt:      dbStore.UpdatedAt.Time,
		ClosedAt:       utils.TimestamptzToTimePtr(dbStore.ClosedAt),
	}
}

var _ services.StoreRepository = (*StoreRepository)(nil)
