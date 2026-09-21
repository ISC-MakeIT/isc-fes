package routers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestUpdateToppingInputBindsOptionalFields(t *testing.T) {
	tests := []struct {
		name          string
		body          string
		wantName      *string
		wantUnitPrice *int32
		wantSoldOut   *bool
	}{
		{name: "all omitted", body: `{}`},
		{name: "name", body: `{"name":"チーズ"}`, wantName: pointer("チーズ")},
		{name: "zero unit price", body: `{"unitPrice":0}`, wantUnitPrice: pointer[int32](0)},
		{name: "false sold out", body: `{"soldOut":false}`, wantSoldOut: pointer(false)},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := httptest.NewRequestWithContext(t.Context(), http.MethodPatch, "/toppings", strings.NewReader(tt.body))
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(response)
			context.Request = request

			var input UpdateToppingInput
			if err := context.ShouldBindJSON(&input); err != nil {
				t.Fatalf("ShouldBindJSON() error = %v", err)
			}
			assertOptionalEqual(t, "Name", input.Name, tt.wantName)
			assertOptionalEqual(t, "UnitPrice", input.UnitPrice, tt.wantUnitPrice)
			assertOptionalEqual(t, "SoldOut", input.SoldOut, tt.wantSoldOut)
		})
	}
}

func pointer[T any](value T) *T {
	return &value
}

func assertOptionalEqual[T comparable](t *testing.T, field string, got, want *T) {
	t.Helper()
	if got == nil || want == nil {
		if got != nil || want != nil {
			t.Errorf("%s = %v, want %v", field, got, want)
		}
		return
	}
	if *got != *want {
		t.Errorf("%s = %v, want %v", field, *got, *want)
	}
}
