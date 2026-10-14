package orders

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

// 書き込み時はStoreのロック後にAccount → Membershipの順で権限を確定する。
// adminの降格もトランザクションが完了するまで待機させる。
// 読み取り専用の注文前チェックではsnapshotを使い、ロックは行わない。
func authorizedMembership(ctx context.Context, queries *sqlc.Queries, accountID, storeID uuid.UUID, lockRows bool) (entities.StoreMembership, error) {
	var account sqlc.Account
	var err error
	if lockRows {
		account, err = queries.LockOrderAccount(ctx, accountID)
	} else {
		account, err = queries.GetAccountByID(ctx, accountID)
	}
	if err != nil {
		return entities.StoreMembership{}, err
	}
	if account.Role == sqlc.RoleAdmin {
		return entities.StoreMembership{StoreID: storeID, AccountID: accountID, Role: entities.StoreMemberRoleManager}, nil
	}
	var membership sqlc.StoreMember
	if lockRows {
		membership, err = queries.LockOrderMembership(ctx, sqlc.LockOrderMembershipParams{StoreID: storeID, AccountID: accountID})
	} else {
		membership, err = queries.GetStoreMembershipByAccountIDAndStoreID(ctx, sqlc.GetStoreMembershipByAccountIDAndStoreIDParams{StoreID: storeID, AccountID: accountID})
	}
	if err != nil {
		return entities.StoreMembership{}, err
	}
	return entities.StoreMembership{
		StoreID: membership.StoreID, AccountID: membership.AccountID,
		Role: entities.StoreMemberRole(membership.Role), JoinedAt: membership.JoinedAt.Time,
	}, nil
}
