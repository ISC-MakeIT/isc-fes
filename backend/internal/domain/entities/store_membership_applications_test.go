package entities

import (
	"testing"

	"github.com/google/uuid"
)

func TestCanSeeStoreMembershipApplications(t *testing.T) {
	cases := []struct {
		name         string
		Account      Account
		Store        Store
		StoreMembers []StoreMember
		Want         bool
	}{
		{
			name: "Admin なら常に true",
			Account: Account{
				Role: RoleAdmin,
			},
			Want: true,
		},
		{
			name: "店舗管理者は自分の店舗のメンバー申請を閲覧可能",
			Account: Account{
				ID:   testUUID("account-id"),
				Role: RoleMember,
			},
			Store: Store{
				ID: testUUID("store-id"),
			},
			StoreMembers: []StoreMember{
				StoreMember{
					Role:      StoreMemberRoleManager,
					StoreID:   testUUID("store-id"),
					AccountID: testUUID("account-id"),
				},
			},
			Want: true,
		},
		{
			name: "店舗メンバーは自分の店舗のメンバー申請を閲覧できない",
			Account: Account{
				ID:   testUUID("account-id"),
				Role: RoleMember,
			},
			Store: Store{
				ID: testUUID("store-id"),
			},
			StoreMembers: []StoreMember{
				StoreMember{
					Role:      StoreMemberRoleMember,
					StoreID:   testUUID("store-id"),
					AccountID: testUUID("account-id"),
				},
			},
			Want: false,
		},
		{
			name: "店舗メンバーでない場合は常に false",
			Account: Account{
				ID:   testUUID("account-id"),
				Role: RoleMember,
			},
			Store: Store{
				ID: testUUID("store-id"),
			},
			StoreMembers: []StoreMember{},
			Want:         false,
		},
	}

	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got := CanSeeStoreMembershipApplications(c.Account, c.Store, c.StoreMembers)
			if got != c.Want {
				t.Errorf("CanSeeStoreMembershipApplications() = %v, want %v", got, c.Want)
			}
		})
	}
}

func testUUID(name string) uuid.UUID {
	return uuid.NewSHA1(uuid.NameSpaceOID, []byte(name))
}
