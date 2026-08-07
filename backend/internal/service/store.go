package service

import (
	"context"
	"errors"
	"fmt"
	"io"
	"slices"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/internal/domain/entities"
	"github.com/isc-makeit/isc-fes/backend/internal/media"
	"github.com/jackc/pgx/v5"
)

type StoreImageRepository interface {
	PutObject(ctx context.Context, reader io.ReadSeeker, objectKey entities.StoreImageObjectKey, contentType string) error

	DeleteObject(ctx context.Context, objectKey entities.StoreImageObjectKey) error

	GetPublicURL(ctx context.Context, objectKey entities.StoreImageObjectKey) (string, error)
}

type StoreRepository interface {
	CreateStoreApplication(ctx context.Context, input CreateStoreApplicationInput) (entities.Store, error)
	GetApprovedStores(ctx context.Context) ([]entities.Store, error)
	GetStoreByID(ctx context.Context, storeID uuid.UUID) (entities.Store, error)
	UpdateStoreReviewStatus(ctx context.Context, storeID uuid.UUID, newStatus entities.StoreReviewStatus) error
}

type CreateStoreApplicationInput struct {
	AccountID      uuid.UUID
	ID             uuid.UUID
	Name           string
	Room           string
	Description    string
	ImageObjectKey entities.StoreImageObjectKey
}

type CreateStoreApplicationServiceInput struct {
	Name        string
	Room        string
	Description string
	ImageReader io.ReadSeeker
}

type StoreService struct {
	imageRepository   StoreImageRepository
	storeRepository   StoreRepository
	accountRepository AccountRepository
	sessions          SessionManager
}

func NewStoreService(imageRepository StoreImageRepository, storeRepository StoreRepository, sessions SessionManager, accountRepository AccountRepository) *StoreService {
	return &StoreService{
		imageRepository:   imageRepository,
		storeRepository:   storeRepository,
		accountRepository: accountRepository,
		sessions:          sessions,
	}
}

var (
	ErrFailedToDetectContentType = errors.New("failed to detect content type")
	ErrFailedToStoreImage        = errors.New("failed to store image")
)

// TODO: 正常系、非対応形式、S3 Put 失敗、DB 失敗、補償 Delete 失敗を StoreService の単体テストで網羅する。
func (s *StoreService) CreateStoreApplication(ctx context.Context, input CreateStoreApplicationServiceInput) (entities.Store, error) {
	allowedContentTypes := [3]string{
		"image/jpeg",
		"image/png",
		"image/webp",
	}

	accountID, err := s.sessions.AccountID(ctx)
	if err != nil {
		return entities.Store{}, ErrUnauthenticated
	}

	storeID, err := uuid.NewRandom()
	if err != nil {
		return entities.Store{}, fmt.Errorf("failed to generate UUID: %w", err)
	}
	objectKey := entities.NewStoreImageObjectKey(storeID)

	contentType, err := media.DetectContentType(input.ImageReader)
	if err != nil {
		// TODO: 原因となった I/O エラーを %w で保持し、ログや errors.Is/As で追跡できるようにする。
		return entities.Store{}, ErrFailedToDetectContentType
	}
	if !slices.Contains(allowedContentTypes[:], contentType) {
		// TODO: ErrUnsupportedImageType を定義して返し、API 層で 415 に変換できるようにする。
		return entities.Store{}, fmt.Errorf("content type %q is not allowed", contentType)
	}

	// TODO: DetectContentType が先頭へ戻す契約を維持するなら、この重複した Seek を削除する。
	_, err = input.ImageReader.Seek(0, io.SeekStart)
	if err != nil {
		return entities.Store{}, fmt.Errorf("failed to seek image reader: %w", err)
	}

	// TODO: 画像全体をデコードして破損・形式偽装を検証し、必要に応じてリサイズや WebP 変換を行う。

	// TODO: ロック付きの最終確認は残したまま、アップロード前に店舗所属済みかを事前確認して不要な S3 Put/Delete を避ける。
	err = s.imageRepository.PutObject(ctx, input.ImageReader, objectKey, contentType)
	if err != nil {
		// TODO: S3 の元エラーを %w で保持し、503 判定や障害調査に利用できるようにする。
		return entities.Store{}, ErrFailedToStoreImage
	}

	store, err := s.storeRepository.CreateStoreApplication(ctx, CreateStoreApplicationInput{
		ID:             storeID,
		AccountID:      accountID,
		Name:           input.Name,
		Room:           input.Room,
		Description:    input.Description,
		ImageObjectKey: objectKey,
	})
	if err != nil {
		// TODO: context.WithoutCancel と短い timeout で補償削除し、DeleteObject の失敗もログまたは errors.Join で保持する。
		s.imageRepository.DeleteObject(ctx, objectKey)
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
	accID, err := s.sessions.AccountID(ctx)
	if err != nil {
		return errors.Join(err, ErrUnauthenticated)
	}

	account, err := s.accountRepository.GetAccountByID(ctx, accID)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return fmt.Errorf("account not found by account id from session: %w", ErrUnauthenticated)
		}
		return fmt.Errorf("failed to get account: %w", err)
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

func (s *StoreService) toStoreOutput(ctx context.Context, store entities.Store) (entities.StoreOutput, error) {
	publicImageURL, err := s.imageRepository.GetPublicURL(ctx, store.ImageObjectKey)
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
	}, nil
}

func (s *StoreService) toStoreOutputs(ctx context.Context, stores []entities.Store) ([]entities.StoreOutput, error) {
	outputs := make([]entities.StoreOutput, len(stores))
	for i, store := range stores {
		output, err := s.toStoreOutput(ctx, store)
		if err != nil {
			return nil, fmt.Errorf("failed to convert store to output: %w", err)
		}
		outputs[i] = output
	}

	return outputs, nil
}

var (
	// 店舗申請の際に、アカウントがすでに店舗を持っている場合のエラー
	ErrAccountAlreadyHasStore = errors.New("account already has a store")
)
