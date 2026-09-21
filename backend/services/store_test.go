package services

import (
	"context"
	"errors"
	"reflect"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	menuentities "github.com/isc-makeit/isc-fes/backend/domains/entities/menus"
	"github.com/jackc/pgx/v5"
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

type updateStoreRepositoryStub struct {
	StoreRepository
	approvedStore entities.Store
	updatedStore  entities.Store
	getErr        error
	updateErr     error
	getCalls      int
	updateCalls   int
	updatedID     uuid.UUID
	updatedClosed bool
}

func (r *updateStoreRepositoryStub) GetApprovedStoreByID(_ context.Context, _ uuid.UUID) (entities.Store, error) {
	r.getCalls++
	return r.approvedStore, r.getErr
}

func (r *updateStoreRepositoryStub) UpdateStoreClosed(_ context.Context, storeID uuid.UUID, closed bool) (entities.Store, error) {
	r.updateCalls++
	r.updatedID = storeID
	r.updatedClosed = closed
	return r.updatedStore, r.updateErr
}

type storeMembershipRepositoryStub struct {
	membership entities.StoreMembership
	err        error
	calls      int
	accountID  uuid.UUID
	storeID    uuid.UUID
}

func (r *storeMembershipRepositoryStub) GetStoreMembershipByAccountIDAndStoreID(_ context.Context, accountID uuid.UUID, storeID uuid.UUID) (entities.StoreMembership, error) {
	r.calls++
	r.accountID = accountID
	r.storeID = storeID
	return r.membership, r.err
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

func TestUpdateStoreUpdatesClosedState(t *testing.T) {
	closedAt := time.Now()
	tests := []struct {
		name          string
		closed        bool
		currentClosed *time.Time
		updatedClosed *time.Time
	}{
		{name: "close store", closed: true, updatedClosed: &closedAt},
		{name: "reopen store", closed: false, currentClosed: &closedAt},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			accountID := uuid.New()
			storeID := uuid.New()
			imageObjectKey := entities.NewStoreImageObjectKey(uuid.New())
			storeRepository := &updateStoreRepositoryStub{
				approvedStore: entities.Store{
					ID:             storeID,
					ImageObjectKey: imageObjectKey,
					ReviewStatus:   entities.StoreReviewStatusApproved,
					ClosedAt:       test.currentClosed,
				},
				updatedStore: entities.Store{
					ID:             storeID,
					ImageObjectKey: imageObjectKey,
					ReviewStatus:   entities.StoreReviewStatusApproved,
					ClosedAt:       test.updatedClosed,
				},
			}
			membershipRepository := &storeMembershipRepositoryStub{
				membership: entities.StoreMembership{Role: entities.StoreMemberRoleManager},
			}
			service := &StoreService{
				storeRepository:           storeRepository,
				storeMembershipRepository: membershipRepository,
				allergenRepository:        &stubAllergenRepository{},
				imgGenerator:              stubStoreImageURLGenerator{},
			}
			ctx := WithAuthenticatedAccount(t.Context(), entities.Account{ID: accountID})

			store, err := service.UpdateStore(ctx, storeID, test.closed)
			if err != nil {
				t.Fatalf("UpdateStore() error = %v", err)
			}

			if storeRepository.updateCalls != 1 {
				t.Fatalf("UpdateStoreClosed() calls = %d, want 1", storeRepository.updateCalls)
			}
			if storeRepository.updatedID != storeID {
				t.Errorf("updated store ID = %v, want %v", storeRepository.updatedID, storeID)
			}
			if storeRepository.updatedClosed != test.closed {
				t.Errorf("updated closed = %t, want %t", storeRepository.updatedClosed, test.closed)
			}
			if !reflect.DeepEqual(store.ClosedAt, test.updatedClosed) {
				t.Errorf("output closedAt = %v, want %v", store.ClosedAt, test.updatedClosed)
			}
			if membershipRepository.accountID != accountID || membershipRepository.storeID != storeID {
				t.Errorf("membership lookup = (%v, %v), want (%v, %v)", membershipRepository.accountID, membershipRepository.storeID, accountID, storeID)
			}
		})
	}
}

func TestUpdateStoreDelegatesUnchangedStateToAtomicUpdate(t *testing.T) {
	closedAt := time.Now()
	tests := []struct {
		name     string
		closed   bool
		closedAt *time.Time
	}{
		{name: "already closed", closed: true, closedAt: &closedAt},
		{name: "already open", closed: false},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			storeID := uuid.New()
			currentStore := entities.Store{
				ID:             storeID,
				ImageObjectKey: entities.NewStoreImageObjectKey(uuid.New()),
				ReviewStatus:   entities.StoreReviewStatusApproved,
				ClosedAt:       test.closedAt,
			}
			storeRepository := &updateStoreRepositoryStub{
				approvedStore: currentStore,
				updatedStore:  currentStore,
			}
			service := &StoreService{
				storeRepository: storeRepository,
				storeMembershipRepository: &storeMembershipRepositoryStub{
					membership: entities.StoreMembership{Role: entities.StoreMemberRoleManager},
				},
				allergenRepository: &stubAllergenRepository{},
				imgGenerator:       stubStoreImageURLGenerator{},
			}
			ctx := WithAuthenticatedAccount(t.Context(), entities.Account{ID: uuid.New()})

			store, err := service.UpdateStore(ctx, storeID, test.closed)
			if err != nil {
				t.Fatalf("UpdateStore() error = %v", err)
			}

			if storeRepository.updateCalls != 1 {
				t.Errorf("UpdateStoreClosed() calls = %d, want 1", storeRepository.updateCalls)
			}
			if !reflect.DeepEqual(store.ClosedAt, test.closedAt) {
				t.Errorf("output closedAt = %v, want %v", store.ClosedAt, test.closedAt)
			}
		})
	}
}

func TestUpdateStoreRejectsUnauthorizedOrInvalidTargets(t *testing.T) {
	storeLookupErr := errors.New("store lookup failed")
	membershipLookupErr := errors.New("membership lookup failed")
	updateErr := errors.New("update failed")
	tests := []struct {
		name            string
		authenticated   bool
		getErr          error
		membershipRole  entities.StoreMemberRole
		membershipErr   error
		updateErr       error
		wantErr         error
		wantGetCalls    int
		wantMemberCalls int
		wantUpdateCalls int
	}{
		{name: "unauthenticated", wantErr: ErrUnauthenticated},
		{name: "store missing or unapproved", authenticated: true, getErr: pgx.ErrNoRows, membershipRole: entities.StoreMemberRoleManager, wantErr: ErrNotFound, wantGetCalls: 1},
		{name: "store lookup failure", authenticated: true, getErr: storeLookupErr, membershipRole: entities.StoreMemberRoleManager, wantErr: storeLookupErr, wantGetCalls: 1},
		{name: "not a store member", authenticated: true, membershipErr: pgx.ErrNoRows, membershipRole: entities.StoreMemberRoleManager, wantErr: ErrForbidden, wantGetCalls: 1, wantMemberCalls: 1},
		{name: "membership lookup failure", authenticated: true, membershipErr: membershipLookupErr, membershipRole: entities.StoreMemberRoleManager, wantErr: membershipLookupErr, wantGetCalls: 1, wantMemberCalls: 1},
		{name: "staff", authenticated: true, membershipRole: entities.StoreMemberRoleStaff, wantErr: ErrForbidden, wantGetCalls: 1, wantMemberCalls: 1},
		{name: "store disappeared before update", authenticated: true, membershipRole: entities.StoreMemberRoleManager, updateErr: pgx.ErrNoRows, wantErr: ErrNotFound, wantGetCalls: 1, wantMemberCalls: 1, wantUpdateCalls: 1},
		{name: "update failure", authenticated: true, membershipRole: entities.StoreMemberRoleManager, updateErr: updateErr, wantErr: updateErr, wantGetCalls: 1, wantMemberCalls: 1, wantUpdateCalls: 1},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			accountID := uuid.New()
			storeID := uuid.New()
			storeRepository := &updateStoreRepositoryStub{
				approvedStore: entities.Store{ID: storeID},
				getErr:        test.getErr,
				updateErr:     test.updateErr,
			}
			membershipRepository := &storeMembershipRepositoryStub{
				membership: entities.StoreMembership{Role: test.membershipRole},
				err:        test.membershipErr,
			}
			service := &StoreService{
				storeRepository:           storeRepository,
				storeMembershipRepository: membershipRepository,
			}
			ctx := t.Context()
			if test.authenticated {
				ctx = WithAuthenticatedAccount(ctx, entities.Account{ID: accountID})
			}

			_, err := service.UpdateStore(ctx, storeID, true)
			if !errors.Is(err, test.wantErr) {
				t.Fatalf("UpdateStore() error = %v, want %v", err, test.wantErr)
			}
			if storeRepository.getCalls != test.wantGetCalls {
				t.Errorf("GetApprovedStoreByID() calls = %d, want %d", storeRepository.getCalls, test.wantGetCalls)
			}
			if membershipRepository.calls != test.wantMemberCalls {
				t.Errorf("GetStoreMembershipByAccountIDAndStoreID() calls = %d, want %d", membershipRepository.calls, test.wantMemberCalls)
			}
			if storeRepository.updateCalls != test.wantUpdateCalls {
				t.Errorf("UpdateStoreClosed() calls = %d, want %d", storeRepository.updateCalls, test.wantUpdateCalls)
			}
		})
	}
}
