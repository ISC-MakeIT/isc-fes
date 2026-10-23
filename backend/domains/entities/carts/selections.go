package carts

import (
	"errors"
	"fmt"
	"slices"
	"strings"

	"github.com/google/uuid"
)

const (
	MaxItemTypes    = 3
	MaxItemQuantity = 10
)

var (
	ErrInvalidQuantity  = errors.New("cart item quantity must be between 1 and 10")
	ErrTooManyItemTypes = errors.New("too many cart item types")
)

// ItemSelection はカート更新と注文確定で共通の数量・種類制限を検証するための選択内容。
type ItemSelection struct {
	MenuID     uuid.UUID
	Quantity   int32
	ToppingIDs []uuid.UUID
}

// ValidateSelections はメニューとトッピングの組み合わせを1種類として数える。
// 同じ組み合わせが複数行ある場合も合計10個まで。空カートへの更新は許可する。
func ValidateSelections(items []ItemSelection) error {
	quantities := make(map[string]int32)
	for i, item := range items {
		if item.Quantity < 1 || item.Quantity > MaxItemQuantity {
			return fmt.Errorf("item %d: %w", i, ErrInvalidQuantity)
		}
		toppingIDs := make([]string, len(item.ToppingIDs))
		for j, id := range item.ToppingIDs {
			toppingIDs[j] = id.String()
		}
		slices.Sort(toppingIDs)
		// 保存時に重複排除されるトッピングも同じ組み合わせとして扱う。
		toppingIDs = slices.Compact(toppingIDs)
		key := item.MenuID.String() + "," + strings.Join(toppingIDs, ",")
		quantities[key] += item.Quantity
		if quantities[key] > MaxItemQuantity {
			return fmt.Errorf("item %d combined quantity: %w", i, ErrInvalidQuantity)
		}
		if len(quantities) > MaxItemTypes {
			return ErrTooManyItemTypes
		}
	}
	return nil
}
