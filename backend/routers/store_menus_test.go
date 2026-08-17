package routers

import (
	"bytes"
	"mime/multipart"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func TestCreateMenuFormBindsUnitPriceFromOpenAPIFieldName(t *testing.T) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	for name, value := range map[string]string{
		"name":        "たこ焼き",
		"description": "外はカリカリ、中はトロトロです。",
		"unitPrice":   "0",
	} {
		if err := writer.WriteField(name, value); err != nil {
			t.Fatalf("WriteField(%q) error = %v", name, err)
		}
	}

	image, err := writer.CreateFormFile("image", "menu.jpg")
	if err != nil {
		t.Fatalf("CreateFormFile() error = %v", err)
	}
	if _, err := image.Write([]byte("image")); err != nil {
		t.Fatalf("image.Write() error = %v", err)
	}
	if err := writer.Close(); err != nil {
		t.Fatalf("writer.Close() error = %v", err)
	}

	request := httptest.NewRequestWithContext(t.Context(), http.MethodPost, "/stores/00000000-0000-0000-0000-000000000000/menus", body)
	request.Header.Set("Content-Type", writer.FormDataContentType())
	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = request

	var form CreateMenuForm
	if err := context.ShouldBind(&form); err != nil {
		t.Fatalf("ShouldBind() error = %v", err)
	}
	if form.UnitPrice == nil {
		t.Fatal("UnitPrice is nil")
	}
	if got := *form.UnitPrice; got != 0 {
		t.Errorf("UnitPrice = %d, want 0", got)
	}
}
