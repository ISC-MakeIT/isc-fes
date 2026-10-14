package orders

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/services"
)

// CheckCheckoutは新規注文の可否を確認する。注文枠の予約やGuestの発行は行わない。
func (s *OrderService) CheckCheckout(ctx context.Context, input CreateInput) error {
	if input.StoreID == uuid.Nil || input.ExpectedCartVersion <= 0 {
		return services.ErrInvalidInput
	}
	guestID, found, err := s.guestResolver.ResolveGuest(ctx)
	if err != nil {
		return fmt.Errorf("resolve checkout guest: %w", err)
	}
	if !found {
		guestID = uuid.Nil
	}
	accountID, err := s.resolveOptionalAccountID(ctx)
	if err != nil {
		return err
	}
	return s.repository.CheckCheckout(ctx, CreateRepositoryInput{
		CreateInput: input, GuestID: guestID, AccountID: accountID,
	})
}

func (s *OrderService) resolveOptionalAccountID(ctx context.Context) (*uuid.UUID, error) {
	account, err := s.accountLoader.GetCurrentAccount(ctx)
	if errors.Is(err, services.ErrUnauthenticated) {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("resolve order account: %w", err)
	}
	if account.ID == uuid.Nil {
		return nil, nil
	}
	return &account.ID, nil
}
