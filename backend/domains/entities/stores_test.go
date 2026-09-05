package entities

import (
	"testing"

	"github.com/google/uuid"
)

func TestImageObjectKey(t *testing.T) {
	imageID, err := uuid.NewRandom()
	if err != nil {
		t.Fatalf("NewRandom() error = %v", err)
	}
	k := NewImageObjectKey(imageID)

	if got, want := k.String(), "images/"+imageID.String(); got != want {
		t.Errorf("NewImageObjectKey() = %q, want %q", got, want)
	}

	if !k.IsValid() {
		t.Errorf("NewImageObjectKey() で生成したキーがバリデーションに失敗")
	}

	var invalidKeys = []string{
		"stores/" + imageID.String(),
		imageObjectKeyPrefix + imageID.String() + "/image",
		imageObjectKeyPrefix + "invalid-uuid",
		imageID.String(),
	}

	for _, invalidKey := range invalidKeys {
		k := ImageObjectKey(invalidKey)
		if k.IsValid() {
			t.Errorf("不正なキーがバリデーションを通過した: %s", invalidKey)
		}
	}
}

func TestStoreReviewStatusCanUpdateTo(t *testing.T) {
	var validTransitions = [][2]StoreReviewStatus{
		{StoreReviewStatusPending, StoreReviewStatusApproved},
		{StoreReviewStatusPending, StoreReviewStatusRejected},
	}
	var invalidTransitions = [][2]StoreReviewStatus{
		{StoreReviewStatusPending, StoreReviewStatusPending},
		{StoreReviewStatusApproved, StoreReviewStatusPending},
		{StoreReviewStatusApproved, StoreReviewStatusApproved},
		{StoreReviewStatusApproved, StoreReviewStatusRejected},
		{StoreReviewStatusRejected, StoreReviewStatusPending},
		{StoreReviewStatusRejected, StoreReviewStatusRejected},
		{StoreReviewStatusRejected, StoreReviewStatusApproved},
	}

	for _, transition := range validTransitions {
		if !transition[0].CanUpdateTo(transition[1]) {
			t.Errorf("有効なはずの遷移が無効と検出された: %s -> %s", transition[0], transition[1])
		}
	}

	for _, transition := range invalidTransitions {
		if transition[0].CanUpdateTo(transition[1]) {
			t.Errorf("無効なはずの遷移が有効と検出された: %s -> %s", transition[0], transition[1])
		}
	}
}

func TestStoreMembershipPermissions(t *testing.T) {
	tests := []struct {
		name    string
		role    StoreMemberRole
		allowed bool
	}{
		{name: "manager", role: StoreMemberRoleManager, allowed: true},
		{name: "staff", role: StoreMemberRoleStaff, allowed: false},
		{name: "unknown role", role: StoreMemberRole("unknown"), allowed: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			membership := StoreMembership{Role: test.role}

			if got := membership.IsMenuManagementAllowed(); got != test.allowed {
				t.Errorf("IsMenuManagementAllowed() = %t, want %t", got, test.allowed)
			}
			if got := membership.IsMemberManagementAllowed(); got != test.allowed {
				t.Errorf("IsMemberManagementAllowed() = %t, want %t", got, test.allowed)
			}
			if got := CanCreateStoreInvitation(membership); got != test.allowed {
				t.Errorf("CanCreateStoreInvitation() = %t, want %t", got, test.allowed)
			}
		})
	}
}
