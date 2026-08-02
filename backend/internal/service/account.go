package service

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/internal/domain/entities"
	service_interface "github.com/isc-makeit/isc-fes/backend/internal/service/interface"
)

type AccountService struct {
	accountRepository service_interface.AccountRepository
}

func NewAccountService(accountRepository service_interface.AccountRepository) *AccountService {
	return &AccountService{
		accountRepository: accountRepository,
	}
}

func (s *AccountService) GetAccountByID(ctx context.Context, accountID uuid.UUID) (entities.Account, error) {
	return s.accountRepository.GetAccountByID(ctx, accountID)
}
