package services

import (
	"bytes"
	"context"
	"errors"
	"io"
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

type passthroughStoreImageProcessor struct{}

func (passthroughStoreImageProcessor) ProcessForStoreImage(_ context.Context, reader io.ReadSeeker) (io.ReadSeeker, string, error) {
	return reader, "image/jpeg", nil
}

type recordingStoreImageRepository struct {
	ImageRepository
	putKeys []entities.StoreImageObjectKey
}

func (r *recordingStoreImageRepository) PutObject(_ context.Context, _ io.ReadSeeker, key entities.StoreImageObjectKey, _ string) error {
	r.putKeys = append(r.putKeys, key)
	return nil
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

func TestCreateStoreApplicationUsesImageIDForObjectKey(t *testing.T) {
	accountID := uuid.New()
	storeRepository := &recordingStoreRepository{}
	imageRepository := &recordingStoreImageRepository{}
	service := &StoreService{
		imageProcessor:  passthroughStoreImageProcessor{},
		imageRepository: imageRepository,
		storeRepository: storeRepository,
		roomsRepository: existingRoomRepository{},
	}
	ctx := WithAuthenticatedAccount(t.Context(), entities.Account{ID: accountID})

	store, err := service.CreateStoreApplication(ctx, CreateStoreApplicationServiceInput{
		Name:        "たこ焼き屋",
		Room:        "605",
		Description: "外はカリカリ、中はトロトロです。",
		ImageReader: bytes.NewReader([]byte("image")),
	})
	if err != nil {
		t.Fatalf("CreateStoreApplication() error = %v", err)
	}

	if len(imageRepository.putKeys) != 1 {
		t.Fatalf("PutObject() calls = %d, want 1", len(imageRepository.putKeys))
	}
	objectKey := imageRepository.putKeys[0]
	if !objectKey.IsValid() {
		t.Errorf("image object key %q is invalid", objectKey)
	}
	if objectKey == entities.NewStoreImageObjectKey(store.ID) {
		t.Error("image object key was derived from the store ID")
	}
	if storeRepository.createInput.ImageObjectKey != objectKey {
		t.Errorf("repository image object key = %q, want %q", storeRepository.createInput.ImageObjectKey, objectKey)
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
