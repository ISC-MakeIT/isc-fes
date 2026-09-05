package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	allergens_service "github.com/isc-makeit/isc-fes/backend/services/allergens"
	"github.com/jackc/pgx/v5"
)

type StoreRepository interface {
	CreateStoreApplication(ctx context.Context, input CreateStoreApplicationInput) (entities.Store, error)
	GetApprovedStores(ctx context.Context) ([]entities.Store, error)
	GetApprovedStoreByID(ctx context.Context, storeID uuid.UUID) (entities.Store, error)
	GetVisibleStoresByAccountID(ctx context.Context, accountID uuid.UUID) ([]entities.Store, error)
	GetStoreByID(ctx context.Context, storeID uuid.UUID) (entities.Store, error)
	UpdateStoreReviewStatus(ctx context.Context, storeID uuid.UUID, newStatus entities.StoreReviewStatus) error
	GetStoreApplications(ctx context.Context) ([]entities.Store, error)
}

type RoomsRepository interface {
	GetRoomByName(c context.Context, name string) (entities.Room, error)
}

// CurrentAccountSessionは、未ログインでも利用できる店舗一覧で
// 現在のAccount IDを任意に解決するための境界。
type CurrentAccountSession interface {
	AccountID(ctx context.Context) (uuid.UUID, error)
}

type CreateStoreApplicationInput struct {
	AccountID      uuid.UUID
	ID             uuid.UUID
	Name           string
	Room           string
	Description    string
	ImageObjectKey entities.ImageObjectKey
}

type CreateStoreApplicationServiceInput struct {
	Name           string
	Room           string
	Description    string
	ImageObjectKey entities.ImageObjectKey
}

type StoreService struct {
	storeRepository    StoreRepository
	allergenRepository allergens_service.AllergenRepository
	imgGenerator       ImageURLGenerator
	accountSession     CurrentAccountSession
	roomsRepository    RoomsRepository
}

func NewStoreService(
	storeRepository StoreRepository,
	allergenRepository allergens_service.AllergenRepository,
	accountSession CurrentAccountSession,
	imgGenerator ImageURLGenerator,
	roomsRepository RoomsRepository,
) *StoreService {
	return &StoreService{
		storeRepository:    storeRepository,
		allergenRepository: allergenRepository,
		imgGenerator:       imgGenerator,
		accountSession:     accountSession,
		roomsRepository:    roomsRepository,
	}
}

func (s *StoreService) GetStoreApplications(ctx context.Context) ([]entities.StoreOutput, error) {
	account, err := RequireAuthenticatedAccount(ctx)
	if err != nil {
		return []entities.StoreOutput{}, err
	}

	if !entities.CanSeeStoreApplications(account) {
		return []entities.StoreOutput{}, ErrForbidden
	}

	rawStoreApplications, err := s.storeRepository.GetStoreApplications(ctx)
	if err != nil {
		return []entities.StoreOutput{}, fmt.Errorf("failed to get store applications: %w", err)
	}

	storeApplications, err := s.toStoreOutputs(ctx, rawStoreApplications)
	if err != nil {
		return []entities.StoreOutput{}, fmt.Errorf("failed to convert stores to outputs: %w", err)
	}

	return storeApplications, nil
}

func (s *StoreService) CreateStoreApplication(ctx context.Context, input CreateStoreApplicationServiceInput) (entities.Store, error) {
	account, err := RequireAuthenticatedAccount(ctx)
	if err != nil {
		return entities.Store{}, err
	}

	_, err = s.roomsRepository.GetRoomByName(ctx, input.Room)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return entities.Store{}, ErrInvalidInput
		}
		return entities.Store{}, fmt.Errorf("failed to get room by name: %w", err)
	}
	if !input.ImageObjectKey.IsValid() {
		return entities.Store{}, ErrInvalidInput
	}

	storeID, err := uuid.NewRandom()
	if err != nil {
		return entities.Store{}, fmt.Errorf("failed to generate UUID: %w", err)
	}
	store, err := s.storeRepository.CreateStoreApplication(ctx, CreateStoreApplicationInput{
		ID:             storeID,
		AccountID:      account.ID,
		Name:           input.Name,
		Room:           input.Room,
		Description:    input.Description,
		ImageObjectKey: input.ImageObjectKey,
	})
	if err != nil {
		return entities.Store{}, fmt.Errorf("failed to create store application: %w", err)
	}

	return store, nil
}

var (
	ErrForbidden                          = errors.New("forbidden")
	ErrNotFound                           = errors.New("not found")
	ErrInvalidStoreReviewStatusTransition = errors.New("invalid store review status transition")
)

func (s *StoreService) UpdateStoreApplicationReviewStatus(ctx context.Context, storeID uuid.UUID, newStatus entities.StoreReviewStatus) error {
	account, err := RequireAuthenticatedAccount(ctx)
	if err != nil {
		return err
	}

	if !account.CanUpdateStoreReviewStatus() {
		return ErrForbidden
	}

	store, err := s.storeRepository.GetStoreByID(ctx, storeID)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return fmt.Errorf("failed to get store by store id: %w", err)
	}

	if !store.ReviewStatus.CanUpdateTo(newStatus) {
		return ErrInvalidStoreReviewStatusTransition
	}

	return s.storeRepository.UpdateStoreReviewStatus(ctx, storeID, newStatus)
}

func (s *StoreService) GetApprovedStores(ctx context.Context) ([]entities.StoreOutput, error) {
	rawStores, err := s.storeRepository.GetApprovedStores(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get approved stores: %w", err)
	}

	stores, err := s.toStoreOutputs(ctx, rawStores)
	if err != nil {
		return nil, fmt.Errorf("failed to convert stores to outputs: %w", err)
	}

	return stores, nil
}

func (s *StoreService) GetApprovedStoreByID(ctx context.Context, storeID uuid.UUID) (entities.StoreOutput, error) {
	store, err := s.storeRepository.GetStoreByID(ctx, storeID)
	if errors.Is(err, pgx.ErrNoRows) {
		return entities.StoreOutput{}, ErrNotFound
	}
	if err != nil {
		return entities.StoreOutput{}, fmt.Errorf("failed to get store by store id: %w", err)
	}

	if store.ReviewStatus != entities.StoreReviewStatusApproved {
		return entities.StoreOutput{}, ErrNotFound
	}

	return s.toStoreOutput(ctx, store)
}

// GetVisibleStores は、ユーザーが閲覧可能な店舗一覧を取得する。
// 承認済みの店舗はすべて返し、申請中・却下済みの店舗は、ユーザーがその店舗の管理者である場合のみ返す。
func (s *StoreService) GetVisibleStores(ctx context.Context) ([]entities.StoreOutput, error) {
	accountID, err := s.accountSession.AccountID(ctx)
	if err != nil {
		rawStores, err := s.storeRepository.GetApprovedStores(ctx)
		if err != nil {
			return nil, fmt.Errorf("failed to get approved stores: %w", err)
		}

		stores, err := s.toStoreOutputs(ctx, rawStores)
		if err != nil {
			return nil, fmt.Errorf("failed to convert stores to outputs: %w", err)
		}

		return stores, nil
	}

	rawStores, err := s.storeRepository.GetVisibleStoresByAccountID(ctx, accountID)
	if err != nil {
		return nil, fmt.Errorf("failed to get visible stores by account id: %w", err)
	}

	stores, err := s.toStoreOutputs(ctx, rawStores)
	if err != nil {
		return nil, fmt.Errorf("failed to convert stores to outputs: %w", err)
	}

	return stores, nil
}

func (s *StoreService) toStoreOutput(ctx context.Context, store entities.Store) (entities.StoreOutput, error) {
	outputs, err := s.toStoreOutputs(ctx, []entities.Store{store})
	if err != nil {
		return entities.StoreOutput{}, err
	}

	return outputs[0], nil
}

func (s *StoreService) buildStoreOutput(ctx context.Context, store entities.Store, allergens []entities.Allergen) (entities.StoreOutput, error) {
	publicImageURL, err := s.imgGenerator.GenerateStoreImageURL(ctx, store.ImageObjectKey)
	if err != nil {
		return entities.StoreOutput{}, fmt.Errorf("failed to get store image URL: %w", err)
	}

	return entities.StoreOutput{
		ID:             store.ID,
		Name:           store.Name,
		Room:           store.Room,
		Description:    store.Description,
		ImageObjectKey: store.ImageObjectKey,
		ImageURL:       publicImageURL,
		ReviewStatus:   store.ReviewStatus,
		SubmittedAt:    store.SubmittedAt,
		UpdatedAt:      store.UpdatedAt,
		CreatedAt:      store.CreatedAt,
		ClosedAt:       store.ClosedAt,
		Allergens:      allergens,
	}, nil
}

func (s *StoreService) toStoreOutputs(ctx context.Context, stores []entities.Store) ([]entities.StoreOutput, error) {
	if len(stores) == 0 {
		return []entities.StoreOutput{}, nil
	}

	storeIDs := make([]uuid.UUID, len(stores))
	for i, store := range stores {
		storeIDs[i] = store.ID
	}

	allergensByStoreID, err := s.allergenRepository.GetStoreAllergensByStoreIDs(ctx, storeIDs)
	if err != nil {
		return nil, fmt.Errorf("failed to get store allergens: %w", err)
	}

	outputs := make([]entities.StoreOutput, len(stores))
	for i, store := range stores {
		allergens := allergensByStoreID[store.ID]
		if allergens == nil {
			allergens = []entities.Allergen{}
		}

		output, err := s.buildStoreOutput(ctx, store, allergens)
		if err != nil {
			return nil, fmt.Errorf("failed to convert store to output: %w", err)
		}
		outputs[i] = output
	}

	return outputs, nil
}
