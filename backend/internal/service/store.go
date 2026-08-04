package service

import (
	"context"
	"errors"
	"io"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/internal/domain/entities"
)

type StoreRepository interface {
	CreateStoreApplication(ctx context.Context, input CreateStoreApplicationInput) (entities.Store, error)
}

type CreateStoreApplicationInput struct {
	AccountID      uuid.UUID
	ID             uuid.UUID
	Name           string
	Room           string
	Description    string
	ImageObjectKey string
}

type CreateStoreApplicationServiceInput struct {
	AccountID   uuid.UUID
	Name        string
	Room        string
	Description string
	ImageReader io.Reader
}

type StoreService struct {
}

func NewStoreService() *StoreService {
	return &StoreService{}
}

func (s *StoreService) CreateStoreApplication(ctx context.Context, input CreateStoreApplicationServiceInput) (entities.Store, error) {
	return entities.Store{}, errors.New("not implemented")
}

var (
	// 店舗申請の際に、アカウントがすでに店舗を持っている場合のエラー
	ErrAccountAlreadyHasStore = errors.New("account already has a store")
)
