package services

import (
	"context"
	"errors"
	"reflect"
	"testing"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	menuentities "github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
)

type stubAllergenRepository struct {
	allergensByStoreID map[uuid.UUID][]entities.Allergen
	err                error
	storeIDs           []uuid.UUID
	calls              int
}

func (s *stubAllergenRepository) GetAllergens(context.Context) ([]entities.Allergen, error) {
	return nil, errors.New("unexpected call to GetAllergens")
}

func (s *stubAllergenRepository) GetStoreAllergensByStoreIDs(_ context.Context, storeIDs []uuid.UUID) (map[uuid.UUID][]entities.Allergen, error) {
	s.calls++
	s.storeIDs = append([]uuid.UUID(nil), storeIDs...)
	return s.allergensByStoreID, s.err
}

type stubStoreImageURLGenerator struct{}

func (stubStoreImageURLGenerator) GenerateStoreImageURL(_ context.Context, objectKey entities.StoreImageObjectKey) (string, error) {
	return "https://example.com/" + objectKey.String(), nil
}

func (stubStoreImageURLGenerator) GenerateMenuImageURL(context.Context, menuentities.MenuImageObjectKey) (string, error) {
	return "", errors.New("unexpected call to GenerateMenuImageURL")
}

type recordingStoreRepository struct {
	StoreRepository
	createInput CreateStoreApplicationInput
}

func (r *recordingStoreRepository) CreateStoreApplication(_ context.Context, input CreateStoreApplicationInput) (entities.Store, error) {
	r.createInput = input
	return entities.Store{
		ID:             input.ID,
		ImageObjectKey: input.ImageObjectKey,
	}, nil
}

type existingRoomRepository struct {
	RoomsRepository
}

func (existingRoomRepository) GetRoomByName(_ context.Context, name string) (entities.Room, error) {
	return entities.Room{Name: name}, nil
}

func TestCreateStoreApplicationUsesUploadedImageObjectKey(t *testing.T) {
	accountID := uuid.New()
	storeRepository := &recordingStoreRepository{}
	service := &StoreService{
		storeRepository: storeRepository,
		roomsRepository: existingRoomRepository{},
	}
	ctx := WithAuthenticatedAccount(t.Context(), entities.Account{ID: accountID})
	imageObjectKey := entities.NewImageObjectKey(uuid.New())

	store, err := service.CreateStoreApplication(ctx, CreateStoreApplicationServiceInput{
		Name:           "たこ焼き屋",
		Room:           "605",
		Description:    "外はカリカリ、中はトロトロです。",
		ImageObjectKey: imageObjectKey,
	})
	if err != nil {
		t.Fatalf("CreateStoreApplication() error = %v", err)
	}

	if storeRepository.createInput.ImageObjectKey != imageObjectKey {
		t.Errorf("repository image object key = %q, want %q", storeRepository.createInput.ImageObjectKey, imageObjectKey)
	}
	if store.ImageObjectKey != imageObjectKey {
		t.Errorf("store image object key = %q, want %q", store.ImageObjectKey, imageObjectKey)
	}
}

func TestCreateStoreApplicationRejectsInvalidImageObjectKey(t *testing.T) {
	storeRepository := &recordingStoreRepository{}
	service := &StoreService{
		storeRepository: storeRepository,
		roomsRepository: existingRoomRepository{},
	}
	ctx := WithAuthenticatedAccount(t.Context(), entities.Account{ID: uuid.New()})

	_, err := service.CreateStoreApplication(ctx, CreateStoreApplicationServiceInput{
		Name:           "たこ焼き屋",
		Room:           "605",
		Description:    "外はカリカリ、中はトロトロです。",
		ImageObjectKey: "stores/not-an-image-id",
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("CreateStoreApplication() error = %v, want ErrInvalidInput", err)
	}
}

func TestStoreServiceToStoreOutputsIncludesAllergens(t *testing.T) {
	storeIDWithAllergens := uuid.New()
	storeIDWithoutAllergens := uuid.New()
	wantAllergens := []entities.Allergen{
		{ID: uuid.New(), Name: "卵"},
		{ID: uuid.New(), Name: "乳"},
	}
	allergenRepository := &stubAllergenRepository{
		allergensByStoreID: map[uuid.UUID][]entities.Allergen{
			storeIDWithAllergens: wantAllergens,
		},
	}
	service := &StoreService{
		allergenRepository: allergenRepository,
		imgGenerator:       stubStoreImageURLGenerator{},
	}
	stores := []entities.Store{
		{ID: storeIDWithAllergens, ImageObjectKey: entities.NewStoreImageObjectKey(storeIDWithAllergens)},
		{ID: storeIDWithoutAllergens, ImageObjectKey: entities.NewStoreImageObjectKey(storeIDWithoutAllergens)},
	}

	outputs, err := service.toStoreOutputs(t.Context(), stores)
	if err != nil {
		t.Fatalf("toStoreOutputs() error = %v", err)
	}

	if allergenRepository.calls != 1 {
		t.Errorf("GetStoreAllergensByStoreIDs() calls = %d, want 1", allergenRepository.calls)
	}
	wantStoreIDs := []uuid.UUID{storeIDWithAllergens, storeIDWithoutAllergens}
	if !reflect.DeepEqual(allergenRepository.storeIDs, wantStoreIDs) {
		t.Errorf("store IDs = %v, want %v", allergenRepository.storeIDs, wantStoreIDs)
	}
	if !reflect.DeepEqual(outputs[0].Allergens, wantAllergens) {
		t.Errorf("allergens = %v, want %v", outputs[0].Allergens, wantAllergens)
	}
	if outputs[1].Allergens == nil {
		t.Error("allergens for store without allergens is nil, want empty slice")
	}
	if len(outputs[1].Allergens) != 0 {
		t.Errorf("allergens length = %d, want 0", len(outputs[1].Allergens))
	}
}
