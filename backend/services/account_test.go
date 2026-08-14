package services

import (
	"context"
	"errors"
	"testing"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/jackc/pgx/v5"
)

type stubAccountRepository struct {
	account entities.Account
	err     error
	calls   int
}

func (s *stubAccountRepository) GetAccountByID(context.Context, uuid.UUID) (entities.Account, error) {
	s.calls++
	return s.account, s.err
}

func (s *stubAccountRepository) UpsertGoogleAccount(context.Context, GoogleIdentity) (entities.Account, error) {
	return entities.Account{}, errors.New("unexpected call to UpsertGoogleAccount")
}

type stubAccountSession struct {
	accountID    uuid.UUID
	accountIDErr error
	signOutErr   error
	signOutCalls int
}

func (s *stubAccountSession) AccountID(context.Context) (uuid.UUID, error) {
	return s.accountID, s.accountIDErr
}

func (s *stubAccountSession) SignOut(context.Context) error {
	s.signOutCalls++
	return s.signOutErr
}

func TestAccountServiceGetCurrentAccount(t *testing.T) {
	databaseErr := errors.New("database unavailable")
	accountID := uuid.New()
	wantAccount := entities.Account{ID: accountID}

	tests := []struct {
		name             string
		session          *stubAccountSession
		repository       *stubAccountRepository
		wantAccount      entities.Account
		wantErr          error
		wantRepository   int
		wantSignOutCalls int
	}{
		{
			name:             "returns account for valid session",
			session:          &stubAccountSession{accountID: accountID},
			repository:       &stubAccountRepository{account: wantAccount},
			wantAccount:      wantAccount,
			wantRepository:   1,
			wantSignOutCalls: 0,
		},
		{
			name:             "rejects missing session",
			session:          &stubAccountSession{accountIDErr: errors.New("not authenticated")},
			repository:       &stubAccountRepository{},
			wantErr:          ErrUnauthenticated,
			wantRepository:   0,
			wantSignOutCalls: 0,
		},
		{
			name:             "rejects and destroys stale session",
			session:          &stubAccountSession{accountID: accountID},
			repository:       &stubAccountRepository{err: pgx.ErrNoRows},
			wantErr:          ErrUnauthenticated,
			wantRepository:   1,
			wantSignOutCalls: 1,
		},
		{
			name:             "returns database failure",
			session:          &stubAccountSession{accountID: accountID},
			repository:       &stubAccountRepository{err: databaseErr},
			wantErr:          databaseErr,
			wantRepository:   1,
			wantSignOutCalls: 0,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			service := NewAccountService(tt.repository, tt.session)

			got, err := service.GetCurrentAccount(context.Background())

			if !errors.Is(err, tt.wantErr) {
				t.Errorf("error = %v, want errors.Is(_, %v)", err, tt.wantErr)
			}
			if got != tt.wantAccount {
				t.Errorf("account = %+v, want %+v", got, tt.wantAccount)
			}
			if tt.repository.calls != tt.wantRepository {
				t.Errorf("GetAccountByID() calls = %d, want %d", tt.repository.calls, tt.wantRepository)
			}
			if tt.session.signOutCalls != tt.wantSignOutCalls {
				t.Errorf("SignOut() calls = %d, want %d", tt.session.signOutCalls, tt.wantSignOutCalls)
			}
		})
	}
}
