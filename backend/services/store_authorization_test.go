package services

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/jackc/pgx/v5"
)

func TestStoreMembershipForAuthorization(t *testing.T) {
	storeID, accountID := uuid.New(), uuid.New()
	for _, test := range []struct {
		name       string
		role       entities.Role
		membership entities.StoreMemberRole
		err        error
		wantRole   entities.StoreMemberRole
		wantCalls  int
	}{
		{"admin without membership", entities.RoleAdmin, "", pgx.ErrNoRows, entities.StoreMemberRoleManager, 0},
		{"admin with staff membership", entities.RoleAdmin, entities.StoreMemberRoleStaff, nil, entities.StoreMemberRoleManager, 0},
		{"manager", entities.RoleMember, entities.StoreMemberRoleManager, nil, entities.StoreMemberRoleManager, 1},
		{"staff", entities.RoleMember, entities.StoreMemberRoleStaff, nil, entities.StoreMemberRoleStaff, 1},
		{"nonmember", entities.RoleMember, "", pgx.ErrNoRows, "", 1},
		{"lookup failure", entities.RoleMember, "", errors.New("lookup failed"), "", 1},
	} {
		t.Run(test.name, func(t *testing.T) {
			repo := &storeMembershipRepositoryStub{membership: entities.StoreMembership{StoreID: storeID, AccountID: accountID, Role: test.membership}, err: test.err}
			got, err := StoreMembershipForAuthorization(t.Context(), repo, entities.Account{ID: accountID, Role: test.role}, storeID)
			wantErr := test.err
			if test.role == entities.RoleAdmin {
				wantErr = nil
			}
			if !errors.Is(err, wantErr) || repo.calls != test.wantCalls || got.Role != test.wantRole {
				t.Fatalf("membership = %+v, error = %v, calls = %d", got, err, repo.calls)
			}
			if err == nil && (got.StoreID != storeID || got.AccountID != accountID) {
				t.Fatalf("membership IDs = %+v", got)
			}
		})
	}
}

type storeReaderStub struct {
	store entities.Store
	err   error
}

func (r storeReaderStub) GetStoreByID(context.Context, uuid.UUID) (entities.Store, error) {
	return r.store, r.err
}

func TestGetStoreForRead(t *testing.T) {
	for _, status := range []entities.StoreReviewStatus{entities.StoreReviewStatusApproved, entities.StoreReviewStatusPending, entities.StoreReviewStatusRejected} {
		for _, role := range []entities.Role{"", entities.RoleMember, entities.RoleAdmin} {
			t.Run(string(status)+"/"+string(role), func(t *testing.T) {
				ctx := t.Context()
				if role != "" {
					ctx = WithAuthenticatedAccount(ctx, entities.Account{Role: role})
				}
				_, err := GetStoreForRead(ctx, storeReaderStub{store: entities.Store{ReviewStatus: status}}, uuid.New())
				want := status == entities.StoreReviewStatusApproved || role == entities.RoleAdmin
				if (err == nil) != want || (!want && !errors.Is(err, ErrNotFound)) {
					t.Fatalf("error = %v, allowed = %v", err, want)
				}
			})
		}
	}
	ctx := WithAuthenticatedAccount(t.Context(), entities.Account{Role: entities.RoleAdmin})
	for _, err := range []error{pgx.ErrNoRows, errors.New("database unavailable")} {
		_, got := GetStoreForRead(ctx, storeReaderStub{err: err}, uuid.New())
		want := err
		if errors.Is(err, pgx.ErrNoRows) {
			want = ErrNotFound
		}
		if !errors.Is(got, want) {
			t.Fatalf("error = %v, want %v", got, want)
		}
	}
}
