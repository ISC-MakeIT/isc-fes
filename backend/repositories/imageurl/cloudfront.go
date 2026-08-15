package imageurl

import (
	"context"
	"fmt"
	"net/url"
	"strings"

	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/isc-makeit/isc-fes/backend/services"
)

// CloudFrontImageURLGenerator generates public store image URLs served by CloudFront.
type CloudFrontImageURLGenerator struct {
	baseURL string
}

func NewCloudFrontImageURLGenerator(rawBaseURL string) (*CloudFrontImageURLGenerator, error) {
	baseURL, err := url.Parse(rawBaseURL)
	if err != nil {
		return nil, fmt.Errorf("parse store image base URL: %w", err)
	}
	if baseURL.Scheme != "https" || baseURL.Host == "" {
		return nil, fmt.Errorf("store image base URL must be an absolute HTTPS URL")
	}
	if baseURL.User != nil || baseURL.RawQuery != "" || baseURL.Fragment != "" {
		return nil, fmt.Errorf("store image base URL must not contain userinfo, query, or fragment")
	}

	baseURL.Path = strings.TrimRight(baseURL.Path, "/")

	return &CloudFrontImageURLGenerator{baseURL: baseURL.String()}, nil
}

func (g *CloudFrontImageURLGenerator) GenerateStoreImageURL(ctx context.Context, objectKey entities.StoreImageObjectKey) (string, error) {
	return g.generateImageURL(ctx, objectKey.String())
}

func (g *CloudFrontImageURLGenerator) GenerateMenuImageURL(ctx context.Context, objectKey menus.MenuImageObjectKey) (string, error) {
	return g.generateImageURL(ctx, objectKey.String())
}

func (g *CloudFrontImageURLGenerator) generateImageURL(_ context.Context, objectKey string) (string, error) {
	imageURL, err := url.JoinPath(g.baseURL, objectKey)
	if err != nil {
		return "", fmt.Errorf("join image URL: %w", err)
	}

	return imageURL, nil
}

var _ services.ImageURLGenerator = (*CloudFrontImageURLGenerator)(nil)
