package routers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCreateMenuInputBindsJSON(t *testing.T) {
	request := httptest.NewRequestWithContext(
		t.Context(),
		http.MethodPost,
		"/stores/00000000-0000-0000-0000-000000000000/menus",
		strings.NewReader(`{
			"name":"たこ焼き",
			"description":"外はカリカリ、中はトロトロです。",
			"unitPrice":0,
			"imageObjectKey":"images/00000000-0000-0000-0000-000000000001",
			"toppingIds":[]
		}`),
	)
	request.Header.Set("Content-Type", "application/json")
	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = request

	var input CreateMenuInput
	if err := context.ShouldBindJSON(&input); err != nil {
		t.Fatalf("ShouldBindJSON() error = %v", err)
	}
	if input.UnitPrice != 0 {
		t.Errorf("UnitPrice = %d, want 0", input.UnitPrice)
	}
	if input.ToppingIds == nil {
		t.Fatal("ToppingIds is nil, want an empty slice")
	}
	if len(*input.ToppingIds) != 0 {
		t.Errorf("len(ToppingIds) = %d, want 0", len(*input.ToppingIds))
	}
}

func TestUpdateMenuInputDistinguishesOmittedAndEmptyToppingIds(t *testing.T) {
	tests := []struct {
		name      string
		body      string
		wantNil   bool
		wantCount int
	}{
		{name: "omitted", body: `{}`, wantNil: true},
		{name: "empty", body: `{"toppingIds":[]}`, wantCount: 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			request := httptest.NewRequestWithContext(t.Context(), http.MethodPatch, "/menus", strings.NewReader(tt.body))
			request.Header.Set("Content-Type", "application/json")
			response := httptest.NewRecorder()
			context, _ := gin.CreateTestContext(response)
			context.Request = request

			var input UpdateMenuInput
			if err := context.ShouldBindJSON(&input); err != nil {
				t.Fatalf("ShouldBindJSON() error = %v", err)
			}
			if tt.wantNil {
				if input.ToppingIds != nil {
					t.Errorf("ToppingIds = %v, want nil", *input.ToppingIds)
				}
				return
			}
			if input.ToppingIds == nil {
				t.Fatal("ToppingIds is nil, want an empty slice")
			}
			if len(*input.ToppingIds) != tt.wantCount {
				t.Errorf("len(ToppingIds) = %d, want %d", len(*input.ToppingIds), tt.wantCount)
			}
		})
	}
}
