package services

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/jackc/pgx/v5"
)

type AccountRepository interface {
	GetAccountByID(ctx context.Context, accountID uuid.UUID) (entities.Account, error)
	UpsertGoogleAccount(ctx context.Context, indentity GoogleIdentity) (entities.Account, error)
}

type AccountSession interface {
	AccountID(ctx context.Context) (uuid.UUID, error)
	SignOut(ctx context.Context) error
}

type AccountService struct {
	accountRepository AccountRepository
	sessions          AccountSession
}

func NewAccountService(accountRepository AccountRepository, sessions AccountSession) *AccountService {
	return &AccountService{
		accountRepository: accountRepository,
		sessions:          sessions,
	}
}

func (s *AccountService) GetAccountByID(ctx context.Context, accountID uuid.UUID) (entities.Account, error) {
	return s.accountRepository.GetAccountByID(ctx, accountID)
}

// 現在のセッションのアカウントを取得する
func (s *AccountService) GetCurrentAccount(ctx context.Context) (entities.Account, error) {
	accountID, err := s.sessions.AccountID(ctx)
	if err != nil {
		return entities.Account{}, ErrUnauthenticated
	}

	acc, err := s.accountRepository.GetAccountByID(ctx, accountID)
	if errors.Is(err, ErrAccountNotFound) || errors.Is(err, pgx.ErrNoRows) {
		_ = s.sessions.SignOut(ctx) // DB からアカウントが削除されている場合、セッションも破棄する
		return entities.Account{}, ErrUnauthenticated
	}

	if err != nil {
		return entities.Account{}, fmt.Errorf("get account: %w", err)
	}

	return acc, nil
}
