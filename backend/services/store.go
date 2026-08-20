package services

import (
	"context"
	"errors"
	"fmt"
	"io"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/jackc/pgx/v5"
)

// ImageProcessorは、利用者がアップロードした画像を店舗画像として配信可能な形式へ変換する。
type ImageProcessor interface {
	// ProcessForStoreImageは、入力画像を検証および変換し、処理後の画像とContent-Typeを返す。
	ProcessForStoreImage(ctx context.Context, reader io.ReadSeeker) (io.ReadSeeker, string, error)
}

type ImageRepository interface {
	PutObject(ctx context.Context, reader io.ReadSeeker, objectKey entities.StoreImageObjectKey, contentType string) error

	DeleteObject(ctx context.Context, objectKey entities.StoreImageObjectKey) error
}

type StoreRepository interface {
	CreateStoreApplication(ctx context.Context, input CreateStoreApplicationInput) (entities.Store, error)
	GetApprovedStores(ctx context.Context) ([]entities.Store, error)
	GetApprovedStoreByID(ctx context.Context, storeID uuid.UUID) (entities.Store, error)
	GetVisibleStoresByAccountID(ctx context.Context, accountID uuid.UUID) ([]entities.Store, error)
	GetStoreByID(ctx context.Context, storeID uuid.UUID) (entities.Store, error)
	UpdateStoreReviewStatus(ctx context.Context, storeID uuid.UUID, newStatus entities.StoreReviewStatus) error
	GetStoreApplications(ctx context.Context) ([]entities.Store, error)
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
	imageProcessor  ImageProcessor
	imageRepository ImageRepository
	storeRepository StoreRepository
	imgGenerator    ImageURLGenerator
	sessions        SessionManager
}

func NewStoreService(
	imageProcessor ImageProcessor,
	imageRepository ImageRepository,
	storeRepository StoreRepository,
	sessions SessionManager,
	imgGenerator ImageURLGenerator,
) *StoreService {
	return &StoreService{
		imageProcessor:  imageProcessor,
		imageRepository: imageRepository,
		storeRepository: storeRepository,
		imgGenerator:    imgGenerator,
		sessions:        sessions,
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

var (
	// ErrEmptyImageは、入力された画像が空であることを示す。
	ErrEmptyImage = errors.New("empty image")
	// ErrImageTooLargeは、入力画像のファイルサイズが上限を超えていることを示す。
	ErrImageTooLarge = errors.New("image too large")
	// ErrUnsupportedImageFormatは、入力画像が対応していない形式であることを示す。
	ErrUnsupportedImageFormat = errors.New("unsupported image format")
	// ErrInvalidImageは、入力画像が破損しているか、画像として解釈できないことを示す。
	ErrInvalidImage = errors.New("invalid image")
	// ErrImageDimensionsExceededは、入力画像の幅、高さ、または総画素数が上限を超えていることを示す。
	ErrImageDimensionsExceeded = errors.New("image dimensions exceeded")
	// ErrProcessedImageTooLargeは、変換後の画像サイズが上限を超えていることを示す。
	ErrProcessedImageTooLarge = errors.New("processed image too large")
)

// TODO: 正常系、非対応形式、S3 Put 失敗、DB 失敗、補償 Delete 失敗を StoreService の単体テストで網羅する。
func (s *StoreService) CreateStoreApplication(ctx context.Context, input CreateStoreApplicationServiceInput) (entities.Store, error) {
	account, err := RequireAuthenticatedAccount(ctx)
	if err != nil {
		return entities.Store{}, err
	}

	storeID, err := uuid.NewRandom()
	if err != nil {
		return entities.Store{}, fmt.Errorf("failed to generate UUID: %w", err)
	}
	objectKey := entities.NewStoreImageObjectKey(storeID)

	processedImage, contentType, err := s.imageProcessor.ProcessForStoreImage(
		ctx,
		input.ImageReader,
	)
	if err != nil {
		return entities.Store{}, fmt.Errorf("process store image: %w", err)
	}

	err = s.imageRepository.PutObject(ctx, processedImage, objectKey, contentType)
	if err != nil {
		// TODO: S3 の元エラーを %w で保持し、503 判定や障害調査に利用できるようにする。
		return entities.Store{}, ErrFailedToStoreImage
	}

	store, err := s.storeRepository.CreateStoreApplication(ctx, CreateStoreApplicationInput{
		ID:             storeID,
		AccountID:      account.ID,
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
	accountID, err := s.sessions.AccountID(ctx)
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
