package orders

import (
	"errors"
	"fmt"
	"math"

	"github.com/google/uuid"
)

const MaxMenuTypes = 3

var (
	ErrEmptyOrder       = errors.New("empty order")
	ErrInvalidItems     = errors.New("invalid order items")
	ErrTooManyMenus     = errors.New("too many menu types")
	ErrAmountOutOfRange = errors.New("order amount out of range")
)

// ValidateItems は保存値だけで判定できる内容制限を検証する。
// 販売可否・現在のmenu_toppingsとの関連・権限は後続Serviceで検証する。
func ValidateItems(storeID uuid.UUID, items []OrderItem) error {
	if len(items) == 0 {
		return ErrEmptyOrder
	}
	if storeID == uuid.Nil {
		return fmt.Errorf("store ID is missing: %w", ErrInvalidItems)
	}
	menuIDs := make(map[uuid.UUID]struct{})
	for i, item := range items {
		if item.StoreID != storeID || item.MenuID == uuid.Nil || item.Quantity <= 0 || item.UnitPrice < 0 {
			return fmt.Errorf("item %d: %w", i, ErrInvalidItems)
		}
		menuIDs[item.MenuID] = struct{}{}
		if len(menuIDs) > MaxMenuTypes {
			return ErrTooManyMenus
		}
		toppingIDs := make(map[uuid.UUID]struct{})
		for _, topping := range item.Toppings {
			if topping.StoreID != storeID || topping.ToppingID == uuid.Nil || topping.UnitPrice < 0 {
				return fmt.Errorf("item %d topping: %w", i, ErrInvalidItems)
			}
			if _, exists := toppingIDs[topping.ToppingID]; exists {
				return fmt.Errorf("item %d duplicate topping: %w", i, ErrInvalidItems)
			}
			toppingIDs[topping.ToppingID] = struct{}{}
		}
	}
	return nil
}

// CalculateTotalAmount は円の整数で計算し、加算・乗算前に範囲を確認する。
func CalculateTotalAmount(storeID uuid.UUID, items []OrderItem) (int64, error) {
	if err := ValidateItems(storeID, items); err != nil {
		return 0, err
	}
	var total int64
	for _, item := range items {
		unitAmount := int64(item.UnitPrice)
		for _, topping := range item.Toppings {
			price := int64(topping.UnitPrice)
			if unitAmount > math.MaxInt64-price {
				return 0, ErrAmountOutOfRange
			}
			unitAmount += price
		}
		quantity := int64(item.Quantity)
		if unitAmount > math.MaxInt64/quantity {
			return 0, ErrAmountOutOfRange
		}
		amount := unitAmount * quantity
		if total > math.MaxInt64-amount {
			return 0, ErrAmountOutOfRange
		}
		total += amount
	}
	return total, nil
}
