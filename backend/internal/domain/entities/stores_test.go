package entities

import (
	"testing"

	"github.com/google/uuid"
)

func TestStoreImageObjectKey(t *testing.T) {
	// TODO: パッケージ名を隠さない変数名に変更し、NewRandom のエラーを戻り値の使用前に確認する。
	uuid, err := uuid.NewRandom()
	k := NewStoreImageObjectKey(uuid)
	if err != nil {
		t.Fatalf("NewRandom() error = %v", err)
	}

	if !k.IsValid() {
		t.Errorf("NewStoreImageObjectKey で生成したキーがバリデーションに失敗")
	}

	var invalidKeys = []string{
		"invalid-prefix/" + uuid.String() + storeImageObjectKeySuffix,
		storeImageObjectKeyPrefix + uuid.String() + "/invalid-suffix",
		"invalid-prefix/" + uuid.String() + "/invalid-suffix",
		storeImageObjectKeyPrefix + "invalid-uuid" + storeImageObjectKeySuffix,
	}

	for _, invalidKey := range invalidKeys {
		k := StoreImageObjectKey(invalidKey)
		if k.IsValid() {
			t.Errorf("不正なキーがバリデーションを通過した: %s", invalidKey)
		}
	}
}
