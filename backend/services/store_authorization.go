package services

import (
	"context"
	"errors"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/jackc/pgx/v5"
)

// StoreMembershipForAuthorization は認可用の店舗権限を返す。
// admin は実際の所属によらず manager として扱い、所属データは変更しない。
// 呼び出し側で店舗の存在や操作ごとの制約を検証する。
func StoreMembershipForAuthorization(ctx context.Context, repository StoreMembershipRepository, account entities.Account, storeID uuid.UUID) (entities.StoreMembership, error) {
	if account.Role == entities.RoleAdmin {
		return entities.StoreMembership{StoreID: storeID, AccountID: account.ID, Role: entities.StoreMemberRoleManager}, nil
	}
	return repository.GetStoreMembershipByAccountIDAndStoreID(ctx, account.ID, storeID)
}

// StoreReader は店舗の存在と閲覧可否の確認に必要な取得操作。
type StoreReader interface {
	GetStoreByID(context.Context, uuid.UUID) (entities.Store, error)
}

// GetStoreForRead は公開済みの店舗、または admin が閲覧する店舗を返す。
func GetStoreForRead(ctx context.Context, repository StoreReader, storeID uuid.UUID) (entities.Store, error) {
	store, err := repository.GetStoreByID(ctx, storeID)
	if errors.Is(err, pgx.ErrNoRows) {
		return entities.Store{}, ErrNotFound
	}
	if err != nil {
		return entities.Store{}, err
	}
	account, _ := RequireAuthenticatedAccount(ctx)
	if !store.IsVisibleInPublic() && account.Role != entities.RoleAdmin {
		return entities.Store{}, ErrNotFound
	}
	return store, nil
}
