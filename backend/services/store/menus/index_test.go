package menus

import (
	"context"
	"errors"
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
	createInput CreateMenuRepositoryInput
	updateCalls int
	updateInput UpdateMenuRepositoryInput
	updateErr   error
}

func (r *recordingMenuRepository) CreateMenuWithToppings(_ context.Context, input CreateMenuRepositoryInput) (menuentities.Menu, error) {
	r.createCalls++
	r.createInput = input
	return menuentities.Menu{
		ID:             input.ID,
		StoreID:        input.StoreID,
		Name:           input.Name,
		Description:    input.Description,
		UnitPrice:      input.UnitPrice,
		ImageObjectKey: input.ImageObjectKey,
	}, nil
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

type recordingMenuImageRepository struct {
	services.ImageRepository
	deleteKeys []entities.StoreImageObjectKey
}

func (r *recordingMenuImageRepository) DeleteObject(_ context.Context, key entities.StoreImageObjectKey) error {
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

func newAuthorizedMenuService(
	accountID uuid.UUID,
	storeID uuid.UUID,
	menuRepository MenuRepository,
	imageURLGenerator services.ImageURLGenerator,
	imageRepository services.ImageRepository,
) *MenuService {
	return NewMenuService(
		menuRepository,
		imageURLGenerator,
		&approvedStoreRepository{store: entities.Store{
			ID:           storeID,
			ReviewStatus: entities.StoreReviewStatusApproved,
		}},
		&managerStoreMembersRepository{membership: entities.StoreMembership{
			StoreID:   storeID,
			AccountID: accountID,
			Role:      entities.StoreMemberRoleManager,
		}},
		imageRepository,
	)
}

func TestCreateMenuUsesSuppliedImageObjectKey(t *testing.T) {
	accountID := uuid.New()
	storeID := uuid.New()
	imageObjectKey := menuentities.NewMenuImageObjectKey(uuid.New())
	menuRepository := &recordingMenuRepository{}
	imageRepository := &recordingMenuImageRepository{}
	service := newAuthorizedMenuService(accountID, storeID, menuRepository, staticMenuImageURLGenerator{}, imageRepository)
	ctx := services.WithAuthenticatedAccount(t.Context(), entities.Account{ID: accountID})

	createdMenu, err := service.CreateMenu(ctx, storeID, CreateMenuInput{
		Name:           "たこ焼き",
		Description:    "外はカリカリ、中はトロトロです。",
		UnitPrice:      500,
		ImageObjectKey: imageObjectKey,
	})
	if err != nil {
		t.Fatalf("CreateMenu() error = %v", err)
	}

	if menuRepository.createInput.ImageObjectKey != imageObjectKey {
		t.Errorf("repository image object key = %q, want %q", menuRepository.createInput.ImageObjectKey, imageObjectKey)
	}
	if len(imageRepository.deleteKeys) != 0 {
		t.Errorf("deleted image object keys = %v, want none", imageRepository.deleteKeys)
	}
	if createdMenu.ImageURL != "https://example.com/"+imageObjectKey.String() {
		t.Errorf("created menu image URL = %q, want uploaded image URL", createdMenu.ImageURL)
	}
}

func TestCreateMenuRejectsInvalidImageObjectKey(t *testing.T) {
	accountID := uuid.New()
	storeID := uuid.New()
	menuRepository := &recordingMenuRepository{}
	service := newAuthorizedMenuService(accountID, storeID, menuRepository, staticMenuImageURLGenerator{}, &recordingMenuImageRepository{})
	ctx := services.WithAuthenticatedAccount(t.Context(), entities.Account{ID: accountID})

	_, err := service.CreateMenu(ctx, storeID, CreateMenuInput{ImageObjectKey: "stores/not-an-image-id"})

	if !errors.Is(err, services.ErrInvalidInput) {
		t.Fatalf("CreateMenu() error = %v, want %v", err, services.ErrInvalidInput)
	}
	if menuRepository.createCalls != 0 {
		t.Errorf("CreateMenu repository calls = %d, want 0", menuRepository.createCalls)
	}
}

func TestCreateMenuDoesNotDeleteSuppliedImageWhenImageURLGenerationFails(t *testing.T) {
	accountID := uuid.New()
	storeID := uuid.New()
	wantErr := errors.New("generate image URL")
	menuRepository := &recordingMenuRepository{}
	imageRepository := &recordingMenuImageRepository{}
	service := newAuthorizedMenuService(
		accountID,
		storeID,
		menuRepository,
		&failingMenuImageURLGenerator{err: wantErr},
		imageRepository,
	)
	ctx := services.WithAuthenticatedAccount(t.Context(), entities.Account{ID: accountID})

	_, err := service.CreateMenu(ctx, storeID, CreateMenuInput{
		ImageObjectKey: menuentities.NewMenuImageObjectKey(uuid.New()),
	})

	if !errors.Is(err, wantErr) {
		t.Fatalf("CreateMenu() error = %v, want %v", err, wantErr)
	}
	if menuRepository.createCalls != 0 {
		t.Errorf("CreateMenu repository calls = %d, want 0", menuRepository.createCalls)
	}
	if len(imageRepository.deleteKeys) != 0 {
		t.Errorf("deleted image object keys = %v, want none", imageRepository.deleteKeys)
	}
}

func TestUpdateMenuReplacesImageUsingSuppliedObjectKey(t *testing.T) {
	accountID := uuid.New()
	storeID := uuid.New()
	menuID := uuid.New()
	oldObjectKey := menuentities.NewMenuImageObjectKey(uuid.New())
	newObjectKey := menuentities.NewMenuImageObjectKey(uuid.New())
	menuRepository := &recordingMenuRepository{menu: menuentities.Menu{
		ID:             menuID,
		StoreID:        storeID,
		ImageObjectKey: oldObjectKey,
	}}
	imageRepository := &recordingMenuImageRepository{}
	service := newAuthorizedMenuService(accountID, storeID, menuRepository, staticMenuImageURLGenerator{}, imageRepository)
	ctx := services.WithAuthenticatedAccount(t.Context(), entities.Account{ID: accountID})

	updatedMenu, err := service.UpdateMenuByStoreIDAndMenuID(ctx, storeID, menuID, UpdateMenuInput{
		ImageObjectKey: &newObjectKey,
	})
	if err != nil {
		t.Fatalf("UpdateMenuByStoreIDAndMenuID() error = %v", err)
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

func TestUpdateMenuDoesNotDeleteImageWhenPersistenceFails(t *testing.T) {
	accountID := uuid.New()
	storeID := uuid.New()
	menuID := uuid.New()
	wantErr := errors.New("update menu")
	oldObjectKey := menuentities.NewMenuImageObjectKey(uuid.New())
	newObjectKey := menuentities.NewMenuImageObjectKey(uuid.New())
	menuRepository := &recordingMenuRepository{
		menu: menuentities.Menu{
			ID:             menuID,
			StoreID:        storeID,
			ImageObjectKey: oldObjectKey,
		},
		updateErr: wantErr,
	}
	imageRepository := &recordingMenuImageRepository{}
	service := newAuthorizedMenuService(accountID, storeID, menuRepository, staticMenuImageURLGenerator{}, imageRepository)
	ctx := services.WithAuthenticatedAccount(t.Context(), entities.Account{ID: accountID})

	_, err := service.UpdateMenuByStoreIDAndMenuID(ctx, storeID, menuID, UpdateMenuInput{
		ImageObjectKey: &newObjectKey,
	})
	if !errors.Is(err, wantErr) {
		t.Fatalf("UpdateMenuByStoreIDAndMenuID() error = %v, want %v", err, wantErr)
	}
	if len(imageRepository.deleteKeys) != 0 {
		t.Errorf("deleted image object keys = %v, want none", imageRepository.deleteKeys)
	}
}

func TestUpdateMenuDoesNotDeleteImageWhenObjectKeyIsUnchanged(t *testing.T) {
	accountID := uuid.New()
	storeID := uuid.New()
	menuID := uuid.New()
	imageObjectKey := menuentities.NewMenuImageObjectKey(uuid.New())
	menuRepository := &recordingMenuRepository{menu: menuentities.Menu{
		ID:             menuID,
		StoreID:        storeID,
		ImageObjectKey: imageObjectKey,
	}}
	imageRepository := &recordingMenuImageRepository{}
	service := newAuthorizedMenuService(accountID, storeID, menuRepository, staticMenuImageURLGenerator{}, imageRepository)
	ctx := services.WithAuthenticatedAccount(t.Context(), entities.Account{ID: accountID})

	_, err := service.UpdateMenuByStoreIDAndMenuID(ctx, storeID, menuID, UpdateMenuInput{
		ImageObjectKey: &imageObjectKey,
	})
	if err != nil {
		t.Fatalf("UpdateMenuByStoreIDAndMenuID() error = %v", err)
	}
	if len(imageRepository.deleteKeys) != 0 {
		t.Errorf("deleted image object keys = %v, want none", imageRepository.deleteKeys)
	}
}
