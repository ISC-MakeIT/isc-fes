package orders

import (
	"errors"
	"math"
	"testing"

	"github.com/google/uuid"
)

var testStoreID = uuid.MustParse("00000000-0000-0000-0000-000000000001")

func orderItem() OrderItem {
	return OrderItem{StoreID: testStoreID, MenuID: uuid.New(), UnitPrice: 300, Quantity: 2}
}

func itemToppings(count int) []OrderItemTopping {
	toppings := make([]OrderItemTopping, count)
	for i := range toppings {
		toppings[i] = OrderItemTopping{StoreID: testStoreID, ToppingID: uuid.New(), UnitPrice: 50}
	}
	return toppings
}

func TestValidateItems(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(*OrderItem)
		want   error
	}{
		{"valid", func(*OrderItem) {}, nil},
		{"zero quantity", func(i *OrderItem) { i.Quantity = 0 }, ErrInvalidItems},
		{"negative quantity", func(i *OrderItem) { i.Quantity = -1 }, ErrInvalidItems},
		{"ten items", func(i *OrderItem) { i.Quantity = 10 }, nil},
		{"eleven items", func(i *OrderItem) { i.Quantity = 11 }, ErrInvalidItems},
		{"int32 maximum quantity", func(i *OrderItem) { i.Quantity = math.MaxInt32 }, ErrInvalidItems},
		{"negative menu price", func(i *OrderItem) { i.UnitPrice = -1 }, ErrInvalidItems},
		{"other store menu", func(i *OrderItem) { i.StoreID = uuid.New() }, ErrInvalidItems},
		{"missing menu ID", func(i *OrderItem) { i.MenuID = uuid.Nil }, ErrInvalidItems},
		{"negative topping price", func(i *OrderItem) { i.Toppings[0].UnitPrice = -1 }, ErrInvalidItems},
		{"other store topping", func(i *OrderItem) { i.Toppings[0].StoreID = uuid.New() }, ErrInvalidItems},
		{"missing topping ID", func(i *OrderItem) { i.Toppings[0].ToppingID = uuid.Nil }, ErrInvalidItems},
		{"duplicate topping", func(i *OrderItem) { i.Toppings = append(i.Toppings, i.Toppings[0]) }, ErrInvalidItems},
		{"six toppings", func(i *OrderItem) { i.Toppings = itemToppings(6) }, nil},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			item := orderItem()
			item.Toppings = itemToppings(5)
			test.mutate(&item)
			items := []OrderItem{item}
			if err := ValidateItems(testStoreID, items); !errors.Is(err, test.want) {
				t.Fatalf("ValidateItems() error = %v, want %v", err, test.want)
			}
			if _, err := CalculateTotalAmount(testStoreID, items); !errors.Is(err, test.want) {
				t.Fatalf("CalculateTotalAmount() error = %v, want %v", err, test.want)
			}
		})
	}
	if err := ValidateItems(testStoreID, nil); !errors.Is(err, ErrEmptyOrder) {
		t.Fatalf("empty order error = %v", err)
	}
	if err := ValidateItems(uuid.Nil, []OrderItem{orderItem()}); !errors.Is(err, ErrInvalidItems) {
		t.Fatalf("missing store error = %v", err)
	}
}

func TestItemLimitCountsMenuAndToppingCombinations(t *testing.T) {
	items := []OrderItem{orderItem(), orderItem(), orderItem()}
	if err := ValidateItems(testStoreID, items); err != nil {
		t.Fatalf("three menus: %v", err)
	}
	items = append(items, orderItem())
	if err := ValidateItems(testStoreID, items); !errors.Is(err, ErrTooManyItemTypes) {
		t.Fatalf("four menus error = %v", err)
	}
	for i := range items {
		items[i].MenuID = items[0].MenuID
		items[i].Toppings = itemToppings(5)
	}
	// 同じmenu IDでもトッピング構成が異なれば別の種類として数える。
	if err := ValidateItems(testStoreID, items); !errors.Is(err, ErrTooManyItemTypes) {
		t.Fatalf("four combinations of one menu: %v", err)
	}
	items[1].Toppings = items[0].Toppings
	if err := ValidateItems(testStoreID, items); err != nil {
		t.Fatalf("same topping on different items: %v", err)
	}
}

func TestItemLimitCombinesQuantitiesAcrossRows(t *testing.T) {
	item := orderItem()
	item.Quantity = 6
	item.Toppings = itemToppings(2)
	other := item
	other.Quantity = 4
	other.Toppings = []OrderItemTopping{item.Toppings[1], item.Toppings[0]}
	if err := ValidateItems(testStoreID, []OrderItem{item, other}); err != nil {
		t.Fatalf("combined quantity of ten: %v", err)
	}
	other.Quantity = 5
	if err := ValidateItems(testStoreID, []OrderItem{item, other}); !errors.Is(err, ErrInvalidItems) {
		t.Fatalf("combined quantity of eleven = %v, want %v", err, ErrInvalidItems)
	}
}

func TestCalculateTotalAmount(t *testing.T) {
	item := orderItem()
	item.Toppings = itemToppings(2)
	other := orderItem()
	other.Quantity = 3
	other.UnitPrice = 100
	if got, err := CalculateTotalAmount(testStoreID, []OrderItem{item, other}); err != nil || got != 1100 {
		t.Fatalf("total = %d, error = %v, want 1100", got, err)
	}
	item.UnitPrice, item.Quantity, item.Toppings = 0, 10, nil
	if got, err := CalculateTotalAmount(testStoreID, []OrderItem{item}); err != nil || got != 0 {
		t.Fatalf("free order total = %d, error = %v", got, err)
	}
	item.UnitPrice = math.MaxInt32
	if got, err := CalculateTotalAmount(testStoreID, []OrderItem{item}); err != nil || got != int64(math.MaxInt32)*10 {
		t.Fatalf("int32 maximum price with ten items total = %d, error = %v", got, err)
	}
	item.Quantity, item.UnitPrice, item.Toppings = 1, math.MaxInt32, itemToppings(5)
	for i := range item.Toppings {
		item.Toppings[i].UnitPrice = math.MaxInt32
	}
	if got, err := CalculateTotalAmount(testStoreID, []OrderItem{item}); err != nil || got != 6*int64(math.MaxInt32) {
		t.Fatalf("unit amount over int32 total = %d, error = %v", got, err)
	}
}
