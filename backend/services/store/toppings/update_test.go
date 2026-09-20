package toppings

import "testing"

func TestUpdateToppingInputIsAllNil(t *testing.T) {
	name := "チーズ"
	unitPrice := int32(0)
	soldOut := false

	tests := []struct {
		name  string
		input UpdateToppingInput
		want  bool
	}{
		{name: "all nil", input: UpdateToppingInput{}, want: true},
		{name: "name", input: UpdateToppingInput{Name: &name}},
		{name: "zero unit price", input: UpdateToppingInput{UnitPrice: &unitPrice}},
		{name: "false sold out", input: UpdateToppingInput{SoldOut: &soldOut}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := tt.input.IsAllNil(); got != tt.want {
				t.Errorf("IsAllNil() = %t, want %t", got, tt.want)
			}
		})
	}
}
