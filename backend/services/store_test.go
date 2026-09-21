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
	allergens          []entities.Allergen
	err                error
	getAllergensErr    error
	storeIDs           []uuid.UUID
	calls              int
	getAllergensCalls  int
}

func (s *stubAllergenRepository) GetAllergens(context.Context) ([]entities.Allergen, error) {
	s.getAllergensCalls++
	return s.allergens, s.getAllergensErr
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
	createCalls int
}

func (r *recordingStoreRepository) CreateStoreApplication(_ context.Context, input CreateStoreApplicationInput) (entities.Store, error) {
	r.createCalls++
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

func TestCreateStoreApplicationPassesAllergenIDsToRepository(t *testing.T) {
	allergenIDs := []uuid.UUID{uuid.New(), uuid.New()}
	allergenRepository := &stubAllergenRepository{
		allergens: []entities.Allergen{
			{ID: allergenIDs[0], Name: "卵"},
			{ID: allergenIDs[1], Name: "乳"},
		},
	}
	storeRepository := &recordingStoreRepository{}
	service := &StoreService{
		storeRepository:    storeRepository,
		allergenRepository: allergenRepository,
		roomsRepository:    existingRoomRepository{},
	}
	ctx := WithAuthenticatedAccount(t.Context(), entities.Account{ID: uuid.New()})

	_, err := service.CreateStoreApplication(ctx, CreateStoreApplicationServiceInput{
		Name:           "たこ焼き屋",
		Room:           "605",
		Description:    "外はカリカリ、中はトロトロです。",
		AllergenIds:    allergenIDs,
		ImageObjectKey: entities.NewImageObjectKey(uuid.New()),
	})
	if err != nil {
		t.Fatalf("店舗申請の作成で予期しないエラー: %v", err)
	}

	if !reflect.DeepEqual(storeRepository.createInput.AllergenIds, allergenIDs) {
		t.Errorf("リポジトリに渡されたアレルゲンID = %v、期待値 %v", storeRepository.createInput.AllergenIds, allergenIDs)
	}
	if allergenRepository.getAllergensCalls != 1 {
		t.Errorf("GetAllergens()の呼び出し回数 = %d、期待値 1", allergenRepository.getAllergensCalls)
	}
}

func TestCreateStoreApplicationAcceptsEmptyAllergenIDs(t *testing.T) {
	allergenRepository := &stubAllergenRepository{
		getAllergensErr: errors.New("空配列の場合はGetAllergens()を呼び出さないでください"),
	}
	storeRepository := &recordingStoreRepository{}
	service := &StoreService{
		storeRepository:    storeRepository,
		allergenRepository: allergenRepository,
		roomsRepository:    existingRoomRepository{},
	}
	ctx := WithAuthenticatedAccount(t.Context(), entities.Account{ID: uuid.New()})

	_, err := service.CreateStoreApplication(ctx, CreateStoreApplicationServiceInput{
		Name:           "たこ焼き屋",
		Room:           "605",
		Description:    "外はカリカリ、中はトロトロです。",
		AllergenIds:    []uuid.UUID{},
		ImageObjectKey: entities.NewImageObjectKey(uuid.New()),
	})
	if err != nil {
		t.Fatalf("店舗申請の作成で予期しないエラー: %v", err)
	}

	if storeRepository.createCalls != 1 {
		t.Errorf("店舗申請リポジトリの呼び出し回数 = %d、期待値 1", storeRepository.createCalls)
	}
	if allergenRepository.getAllergensCalls != 0 {
		t.Errorf("GetAllergens()の呼び出し回数 = %d、期待値 0", allergenRepository.getAllergensCalls)
	}
}

func TestCreateStoreApplicationRejectsUnknownAllergenID(t *testing.T) {
	registeredAllergenID := uuid.New()
	storeRepository := &recordingStoreRepository{}
	service := &StoreService{
		storeRepository: storeRepository,
		allergenRepository: &stubAllergenRepository{
			allergens: []entities.Allergen{{ID: registeredAllergenID, Name: "卵"}},
		},
		roomsRepository: existingRoomRepository{},
	}
	ctx := WithAuthenticatedAccount(t.Context(), entities.Account{ID: uuid.New()})

	_, err := service.CreateStoreApplication(ctx, CreateStoreApplicationServiceInput{
		Name:           "たこ焼き屋",
		Room:           "605",
		Description:    "外はカリカリ、中はトロトロです。",
		AllergenIds:    []uuid.UUID{registeredAllergenID, uuid.New()},
		ImageObjectKey: entities.NewImageObjectKey(uuid.New()),
	})
	if !errors.Is(err, ErrInvalidInput) {
		t.Fatalf("店舗申請のエラー = %v、期待値 ErrInvalidInput", err)
	}
	if storeRepository.createCalls != 0 {
		t.Errorf("店舗申請リポジトリの呼び出し回数 = %d、期待値 0", storeRepository.createCalls)
	}
}

func TestCreateStoreApplicationPropagatesAllergenLookupError(t *testing.T) {
	wantErr := errors.New("アレルゲン一覧の取得エラー")
	storeRepository := &recordingStoreRepository{}
	service := &StoreService{
		storeRepository: storeRepository,
		allergenRepository: &stubAllergenRepository{
			getAllergensErr: wantErr,
		},
		roomsRepository: existingRoomRepository{},
	}
	ctx := WithAuthenticatedAccount(t.Context(), entities.Account{ID: uuid.New()})

	_, err := service.CreateStoreApplication(ctx, CreateStoreApplicationServiceInput{
		Name:           "たこ焼き屋",
		Room:           "605",
		Description:    "外はカリカリ、中はトロトロです。",
		AllergenIds:    []uuid.UUID{uuid.New()},
		ImageObjectKey: entities.NewImageObjectKey(uuid.New()),
	})
	if !errors.Is(err, wantErr) {
		t.Fatalf("店舗申請のエラー = %v、ラップされる期待エラー %v", err, wantErr)
	}
	if storeRepository.createCalls != 0 {
		t.Errorf("店舗申請リポジトリの呼び出し回数 = %d、期待値 0", storeRepository.createCalls)
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
