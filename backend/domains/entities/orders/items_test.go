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

func TestMenuLimitCountsDistinctMenus(t *testing.T) {
	items := []OrderItem{orderItem(), orderItem(), orderItem()}
	if err := ValidateItems(testStoreID, items); err != nil {
		t.Fatalf("three menus: %v", err)
	}
	items = append(items, orderItem())
	if err := ValidateItems(testStoreID, items); !errors.Is(err, ErrTooManyMenus) {
		t.Fatalf("four menus error = %v", err)
	}
	for i := range items {
		items[i].MenuID = items[0].MenuID
		items[i].Toppings = itemToppings(5)
	}
	// 同じmenu IDでもトッピング構成ごとに別明細を許可する。
	if err := ValidateItems(testStoreID, items); err != nil {
		t.Fatalf("four lines of one menu: %v", err)
	}
	items[1].Toppings = items[0].Toppings
	if err := ValidateItems(testStoreID, items); err != nil {
		t.Fatalf("same topping on different items: %v", err)
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
	item.UnitPrice, item.Quantity, item.Toppings = 0, math.MaxInt32, nil
	if got, err := CalculateTotalAmount(testStoreID, []OrderItem{item}); err != nil || got != 0 {
		t.Fatalf("free order total = %d, error = %v", got, err)
	}
	item.UnitPrice = math.MaxInt32
	if got, err := CalculateTotalAmount(testStoreID, []OrderItem{item}); err != nil || got != int64(math.MaxInt32)*math.MaxInt32 {
		t.Fatalf("int32 maximum price and quantity total = %d, error = %v", got, err)
	}
	item.Quantity, item.UnitPrice, item.Toppings = 1, math.MaxInt32, itemToppings(5)
	for i := range item.Toppings {
		item.Toppings[i].UnitPrice = math.MaxInt32
	}
	if got, err := CalculateTotalAmount(testStoreID, []OrderItem{item}); err != nil || got != 6*int64(math.MaxInt32) {
		t.Fatalf("unit amount over int32 total = %d, error = %v", got, err)
	}
}

func TestCalculateTotalAmountOverflow(t *testing.T) {
	high := orderItem()
	high.UnitPrice, high.Quantity = math.MaxInt32, math.MaxInt32
	tail := high
	tail.Quantity = 4
	one := orderItem()
	one.UnitPrice, one.Quantity = 1, 1
	// 2*M*M + 4*M + 1 == MaxInt64, where M == MaxInt32.
	items := []OrderItem{high, high, tail, one}
	if got, err := CalculateTotalAmount(testStoreID, items); err != nil || got != math.MaxInt64 {
		t.Fatalf("exact MaxInt64 total = %d, error = %v", got, err)
	}
	items[3].Quantity = 2
	if _, err := CalculateTotalAmount(testStoreID, items); !errors.Is(err, ErrAmountOutOfRange) {
		t.Fatalf("MaxInt64 + 1 error = %v", err)
	}
	if _, err := CalculateTotalAmount(testStoreID, []OrderItem{high, high, high}); !errors.Is(err, ErrAmountOutOfRange) {
		t.Fatalf("sum overflow error = %v", err)
	}
	high.Toppings = itemToppings(2)
	for i := range high.Toppings {
		high.Toppings[i].UnitPrice = math.MaxInt32
	}
	if _, err := CalculateTotalAmount(testStoreID, []OrderItem{high}); !errors.Is(err, ErrAmountOutOfRange) {
		t.Fatalf("multiplication overflow error = %v", err)
	}
}
