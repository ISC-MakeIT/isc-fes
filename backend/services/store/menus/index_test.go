package menus

import (
	"bytes"
	"context"
	"errors"
	"io"
	"testing"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	menuentities "github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/isc-makeit/isc-fes/backend/services"
	repositoryinterfaces "github.com/isc-makeit/isc-fes/backend/services/repository_interfaces"
)

type recordingMenuRepository struct {
	MenuRepository
	createCalls int
}

func (r *recordingMenuRepository) CreateMenu(context.Context, CreateMenuRepositoryInput) (menuentities.Menu, error) {
	r.createCalls++
	return menuentities.Menu{}, nil
}

type approvedStoreRepository struct {
	services.StoreRepository
	store entities.Store
}

func (r *approvedStoreRepository) GetStoreByID(context.Context, uuid.UUID) (entities.Store, error) {
	return r.store, nil
}

type managerStoreMembersRepository struct {
	repositoryinterfaces.StoreMembersRepository
	membership entities.StoreMembership
}

func (r *managerStoreMembersRepository) GetStoreMembershipByAccountIDAndStoreID(context.Context, uuid.UUID, uuid.UUID) (entities.StoreMembership, error) {
	return r.membership, nil
}

type passthroughMenuImageProcessor struct{}

func (passthroughMenuImageProcessor) ProcessForMenuImage(_ context.Context, reader io.ReadSeeker) (io.ReadSeeker, string, error) {
	return reader, "image/jpeg", nil
}

type recordingMenuImageRepository struct {
	services.ImageRepository
	putCalls    int
	deleteCalls int
}

func (r *recordingMenuImageRepository) PutObject(context.Context, io.ReadSeeker, entities.StoreImageObjectKey, string) error {
	r.putCalls++
	return nil
}

func (r *recordingMenuImageRepository) DeleteObject(context.Context, entities.StoreImageObjectKey) error {
	r.deleteCalls++
	return nil
}

type failingMenuImageURLGenerator struct {
	services.ImageURLGenerator
	err error
}

func (g *failingMenuImageURLGenerator) GenerateMenuImageURL(context.Context, menuentities.MenuImageObjectKey) (string, error) {
	return "", g.err
}

func TestCreateMenuDoesNotPersistWhenImageURLGenerationFails(t *testing.T) {
	accountID := uuid.New()
	storeID := uuid.New()
	wantErr := errors.New("generate image URL")
	menuRepository := &recordingMenuRepository{}
	imageRepository := &recordingMenuImageRepository{}
	service := NewMenuService(
		menuRepository,
		&failingMenuImageURLGenerator{err: wantErr},
		&approvedStoreRepository{store: entities.Store{
			ID:           storeID,
			ReviewStatus: entities.StoreReviewStatusApproved,
		}},
		&managerStoreMembersRepository{membership: entities.StoreMembership{
			StoreID:   storeID,
			AccountID: accountID,
			Role:      entities.StoreMemberRoleManager,
		}},
		passthroughMenuImageProcessor{},
		imageRepository,
	)
	ctx := services.WithAuthenticatedAccount(t.Context(), entities.Account{ID: accountID})

	_, err := service.CreateMenu(ctx, storeID, CreateMenuInput{
		Name:        "たこ焼き",
		Description: "外はカリカリ、中はトロトロです。",
		UnitPrice:   500,
		ImageReader: bytes.NewReader([]byte("image")),
	})

	if !errors.Is(err, wantErr) {
		t.Fatalf("CreateMenu() error = %v, want %v", err, wantErr)
	}
	if menuRepository.createCalls != 0 {
		t.Errorf("CreateMenu repository calls = %d, want 0", menuRepository.createCalls)
	}
	if imageRepository.putCalls != 1 {
		t.Errorf("PutObject() calls = %d, want 1", imageRepository.putCalls)
	}
	if imageRepository.deleteCalls != 1 {
		t.Errorf("DeleteObject() calls = %d, want 1", imageRepository.deleteCalls)
	}
}
