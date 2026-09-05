package imageurl

import (
	"context"
	"testing"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

func TestCloudFrontImageURLGeneratorGenerateStoreImageURL(t *testing.T) {
	generator, err := NewCloudFrontImageURLGenerator("https://d111111abcdef8.cloudfront.net/")
	if err != nil {
		t.Fatalf("NewCloudFrontImageURLGenerator() error = %v", err)
	}

	objectKey := entities.NewStoreImageObjectKey(uuid.MustParse("e625d731-8d26-4de9-ac77-a1bc96affb8e"))
	got, err := generator.GenerateStoreImageURL(context.Background(), objectKey)
	if err != nil {
		t.Fatalf("GenerateStoreImageURL() error = %v", err)
	}

	want := "https://d111111abcdef8.cloudfront.net/images/e625d731-8d26-4de9-ac77-a1bc96affb8e"
	if got != want {
		t.Errorf("GenerateStoreImageURL() = %q, want %q", got, want)
	}
}

func TestNewCloudFrontImageURLGeneratorRejectsInvalidBaseURL(t *testing.T) {
	tests := []struct {
		name    string
		baseURL string
	}{
		{name: "relative URL", baseURL: "d111111abcdef8.cloudfront.net"},
		{name: "HTTP URL", baseURL: "http://d111111abcdef8.cloudfront.net"},
		{name: "query", baseURL: "https://d111111abcdef8.cloudfront.net?foo=bar"},
		{name: "fragment", baseURL: "https://d111111abcdef8.cloudfront.net#fragment"},
		{name: "userinfo", baseURL: "https://user@d111111abcdef8.cloudfront.net"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if _, err := NewCloudFrontImageURLGenerator(tt.baseURL); err == nil {
				t.Errorf("NewCloudFrontImageURLGenerator(%q) did not return an error", tt.baseURL)
			}
		})
	}
}
