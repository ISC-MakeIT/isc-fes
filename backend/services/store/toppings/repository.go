package toppings

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/toppings"
)

type UpdateToppingRepositoryInput struct {
	Name      string
	UnitPrice int32
	SoldOut   bool
}

type ToppingsRepository interface {
	GetToppingsByStoreID(c context.Context, storeID uuid.UUID) ([]toppings.Topping, error)
	CreateTopping(c context.Context, storeID uuid.UUID, name string, unitPrice int32) (toppings.Topping, error)
	UpdateToppingByToppingIDAndStoreID(c context.Context, toppingID, storeID uuid.UUID, input UpdateToppingRepositoryInput) (toppings.Topping, error)
	// 指定されたトッピングを削除する（論理削除）
	// menu_toppings テーブルの関連付けも削除する
	DeleteTopping(c context.Context, storeID, toppingID uuid.UUID) error
}
