package db2entities

import (
	"time"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/carts"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/jackc/pgx/v5/pgtype"
)

func ToCart(raw []sqlc.GetCartByGuestIDAndStoreIDRow) carts.Cart {
	if len(raw) == 0 {
		return carts.Cart{Items: []carts.CartItem{}}
	}

	cart := carts.Cart{
		ID:      raw[0].CartID, // 全ての行で同じ値なので、最初の行から取得
		GuestID: raw[0].GuestID,
		StoreID: raw[0].StoreID,
		Items:   make([]carts.CartItem, 0, len(raw)),
	}
	itemIndexByID := make(map[uuid.UUID]int, len(raw))

	for _, row := range raw {
		itemIndex, exists := itemIndexByID[row.CartItemID]
		if !exists {
			// 初めて見たCartItemIDの場合、新しいCartItemを作成して追加
			itemIndex = len(cart.Items)
			itemIndexByID[row.CartItemID] = itemIndex
			cart.Items = append(cart.Items, carts.CartItem{
				ID:             row.CartItemID,
				CartID:         row.CartID,
				MenuID:         row.MenuID,
				Name:           row.MenuName,
				ImageObjectKey: menus.MenuImageObjectKey(row.MenuImageObjectKey),
				Soldout:        row.MenuSoldOut,
				DeletedAt:      timestampPointer(row.MenuDeletedAt),
				StoreID:        row.StoreID,
				Quantity:       row.CartItemQuantity,
				UnitPrice:      row.MenuUnitPrice,
				Toppings:       []carts.CartItemTopping{},
			})
		}

		// Topping が存在しない場合はスキップ
		if row.CartItemToppingID == nil ||
			row.ToppingID == nil ||
			row.ToppingName == nil ||
			row.ToppingUnitPrice == nil ||
			row.ToppingSoldOut == nil {
			continue
		}

		cart.Items[itemIndex].Toppings = append(
			cart.Items[itemIndex].Toppings,
			carts.CartItemTopping{
				ID:         *row.CartItemToppingID,
				CartItemID: row.CartItemID,
				MenuID:     row.MenuID,
				ToppingID:  *row.ToppingID,
				Name:       *row.ToppingName,
				UnitPrice:  *row.ToppingUnitPrice,
				Soldout:    *row.ToppingSoldOut,
				DeletedAt:  timestampPointer(row.ToppingDeletedAt),
			},
		)
	}

	return cart
}

func timestampPointer(timestamp pgtype.Timestamptz) *time.Time {
	if !timestamp.Valid {
		return nil
	}

	value := timestamp.Time
	return &value
}
