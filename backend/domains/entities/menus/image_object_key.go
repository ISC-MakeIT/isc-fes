package menus

import (
	"strings"

	"github.com/google/uuid"
)

type MenuImageObjectKey string

const (
	menuImageObjectKeyPrefix = "menus/"
	menuImageObjectKeySuffix = "/image"
)

func NewMenuImageObjectKey(menuID uuid.UUID) MenuImageObjectKey {
	return MenuImageObjectKey(menuImageObjectKeyPrefix + menuID.String() + menuImageObjectKeySuffix)
}

func (k MenuImageObjectKey) String() string {
	return string(k)
}

func (k MenuImageObjectKey) IsValid() bool {
	if !strings.HasPrefix(string(k), menuImageObjectKeyPrefix) {
		return false
	}
	if !strings.HasSuffix(string(k), menuImageObjectKeySuffix) {
		return false
	}

	// menuID 部分が UUID 形式かどうかを確認する
	menuIDStr := strings.TrimPrefix(string(k), menuImageObjectKeyPrefix)
	menuIDStr = strings.TrimSuffix(menuIDStr, menuImageObjectKeySuffix)
	_, err := uuid.Parse(menuIDStr)
	return err == nil
}
