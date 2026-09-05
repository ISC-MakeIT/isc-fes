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
	menu        menuentities.Menu
	createCalls int
	updateCalls int
	updateInput UpdateMenuRepositoryInput
	updateErr   error
}

func (r *recordingMenuRepository) CreateMenuWithToppings(context.Context, CreateMenuRepositoryInput) (menuentities.Menu, error) {
	r.createCalls++
	return menuentities.Menu{}, nil
}

func (r *recordingMenuRepository) GetMenuByStoreIDAndMenuID(context.Context, uuid.UUID, uuid.UUID) (menuentities.Menu, error) {
	return r.menu, nil
}

func (r *recordingMenuRepository) UpdateMenuWithToppings(_ context.Context, input UpdateMenuRepositoryInput) (menuentities.Menu, error) {
	r.updateCalls++
	r.updateInput = input
	if r.updateErr != nil {
		return menuentities.Menu{}, r.updateErr
	}
	if input.ImageObjectKey != nil {
		r.menu.ImageObjectKey = *input.ImageObjectKey
	}
	return r.menu, nil
}

type approvedStoreRepository struct {
	services.StoreRepository
	store entities.Store
}

func (r *approvedStoreRepository) GetStoreByID(context.Context, uuid.UUID) (entities.Store, error) {
	return r.store, nil
}

func (r *approvedStoreRepository) GetApprovedStoreByID(context.Context, uuid.UUID) (entities.Store, error) {
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
	putKeys     []entities.StoreImageObjectKey
	deleteKeys  []entities.StoreImageObjectKey
}

func (r *recordingMenuImageRepository) PutObject(_ context.Context, _ io.ReadSeeker, key entities.StoreImageObjectKey, _ string) error {
	r.putCalls++
	r.putKeys = append(r.putKeys, key)
	return nil
}

func (r *recordingMenuImageRepository) DeleteObject(_ context.Context, key entities.StoreImageObjectKey) error {
	r.deleteCalls++
	r.deleteKeys = append(r.deleteKeys, key)
	return nil
}

type failingMenuImageURLGenerator struct {
	services.ImageURLGenerator
	err error
}

func (g *failingMenuImageURLGenerator) GenerateMenuImageURL(context.Context, menuentities.MenuImageObjectKey) (string, error) {
	return "", g.err
}

type staticMenuImageURLGenerator struct {
	services.ImageURLGenerator
}

func (staticMenuImageURLGenerator) GenerateMenuImageURL(_ context.Context, key menuentities.MenuImageObjectKey) (string, error) {
	return "https://example.com/" + key.String(), nil
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

func TestUpdateMenuReplacesImageUsingUniqueObjectKey(t *testing.T) {
	accountID := uuid.New()
	storeID := uuid.New()
	menuID := uuid.New()
	oldObjectKey := menuentities.NewMenuImageObjectKey(uuid.New())
	menuRepository := &recordingMenuRepository{menu: menuentities.Menu{
		ID:             menuID,
		StoreID:        storeID,
		ImageObjectKey: oldObjectKey,
	}}
	imageRepository := &recordingMenuImageRepository{}
	service := NewMenuService(
		menuRepository,
		staticMenuImageURLGenerator{},
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

	updatedMenu, err := service.UpdateMenuByStoreIDAndMenuID(ctx, storeID, menuID, UpdateMenuInput{
		ImageReader: bytes.NewReader([]byte("new image")),
	})
	if err != nil {
		t.Fatalf("UpdateMenuByStoreIDAndMenuID() error = %v", err)
	}

	if len(imageRepository.putKeys) != 1 {
		t.Fatalf("PutObject() calls = %d, want 1", len(imageRepository.putKeys))
	}
	newObjectKey := imageRepository.putKeys[0]
	if !newObjectKey.IsValid() {
		t.Errorf("new image object key %q is invalid", newObjectKey)
	}
	if newObjectKey == oldObjectKey {
		t.Error("new image overwrote the old image object")
	}
	if newObjectKey == menuentities.NewMenuImageObjectKey(menuID) {
		t.Error("new image object key was derived from the menu ID")
	}
	if menuRepository.updateInput.ImageObjectKey == nil || *menuRepository.updateInput.ImageObjectKey != newObjectKey {
		t.Errorf("repository image object key = %v, want %q", menuRepository.updateInput.ImageObjectKey, newObjectKey)
	}
	if len(imageRepository.deleteKeys) != 1 || imageRepository.deleteKeys[0] != oldObjectKey {
		t.Errorf("deleted image object keys = %v, want [%q]", imageRepository.deleteKeys, oldObjectKey)
	}
	if updatedMenu.ImageURL != "https://example.com/"+newObjectKey.String() {
		t.Errorf("updated menu image URL = %q, want new image URL", updatedMenu.ImageURL)
	}
}

func TestUpdateMenuDeletesNewImageWhenPersistenceFails(t *testing.T) {
	accountID := uuid.New()
	storeID := uuid.New()
	menuID := uuid.New()
	oldObjectKey := menuentities.NewMenuImageObjectKey(uuid.New())
	wantErr := errors.New("update menu")
	menuRepository := &recordingMenuRepository{
		menu: menuentities.Menu{
			ID:             menuID,
			StoreID:        storeID,
			ImageObjectKey: oldObjectKey,
		},
		updateErr: wantErr,
	}
	imageRepository := &recordingMenuImageRepository{}
	service := NewMenuService(
		menuRepository,
		staticMenuImageURLGenerator{},
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

	_, err := service.UpdateMenuByStoreIDAndMenuID(ctx, storeID, menuID, UpdateMenuInput{
		ImageReader: bytes.NewReader([]byte("new image")),
	})
	if !errors.Is(err, wantErr) {
		t.Fatalf("UpdateMenuByStoreIDAndMenuID() error = %v, want %v", err, wantErr)
	}

	if len(imageRepository.putKeys) != 1 {
		t.Fatalf("PutObject() calls = %d, want 1", len(imageRepository.putKeys))
	}
	if len(imageRepository.deleteKeys) != 1 || imageRepository.deleteKeys[0] != imageRepository.putKeys[0] {
		t.Errorf("deleted image object keys = %v, want new image key %q", imageRepository.deleteKeys, imageRepository.putKeys[0])
	}
	if len(imageRepository.deleteKeys) == 1 && imageRepository.deleteKeys[0] == oldObjectKey {
		t.Error("old image was deleted even though persistence failed")
	}
}
