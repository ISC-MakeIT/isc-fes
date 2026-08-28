package menus

import (
	"context"
	"io"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
)

type CreateMenuRepositoryInput struct {
	ID             uuid.UUID
	StoreID        uuid.UUID
	Name           string
	Description    string
	UnitPrice      int32
	ToppingIds     []uuid.UUID
	ImageObjectKey menus.MenuImageObjectKey
}

// メニューの更新のためのリポジトリ入力構造体
// ID, StoreID は更新不可で、where 句に使用される
type UpdateMenuRepositoryInput struct {
	ID             uuid.UUID
	StoreID        uuid.UUID
	Name           *string
	Description    *string
	UnitPrice      *int32
	ToppingIds     *[]uuid.UUID
	ImageObjectKey *menus.MenuImageObjectKey
}
type MenuRepository interface {
	GetMenusByStoreID(c context.Context, storeID uuid.UUID) ([]menus.Menu, error)
	GetMenuByStoreIDAndMenuID(c context.Context, storeID uuid.UUID, menuID uuid.UUID) (menus.Menu, error)
	CreateMenuWithToppings(c context.Context, input CreateMenuRepositoryInput) (menus.Menu, error)
	UpdateMenuWithToppings(c context.Context, input UpdateMenuRepositoryInput) (menus.Menu, error)
	DeleteMenuByStoreIDAndMenuID(c context.Context, storeID uuid.UUID, menuID uuid.UUID) (int64, error)
}

type ImageProcessor interface {
	// ProcessForMenuImageは、入力画像を検証および変換し、処理後の画像とContent-Typeを返す
	ProcessForMenuImage(ctx context.Context, reader io.ReadSeeker) (io.ReadSeeker, string, error)
}
