package services

import (
	"context"
	"fmt"

	"github.com/google/uuid"
)

// GuestSessionは、現在のブラウザに紐づくGuest IDを管理する境界。
type GuestSession interface {
	GuestID(ctx context.Context) (guestID uuid.UUID, found bool, err error)
	BindGuest(ctx context.Context, guestID uuid.UUID) error
}

type GuestRepository interface {
	CreateGuest(ctx context.Context) (uuid.UUID, error)
}

type GuestService struct {
	session    GuestSession
	repository GuestRepository
}

func NewGuestService(session GuestSession, repository GuestRepository) *GuestService {
	return &GuestService{
		session:    session,
		repository: repository,
	}
}

// ResolveGuestは現在のGuest IDを返す。Guestが未発行の場合は作成しない。
func (s *GuestService) ResolveGuest(ctx context.Context) (guestID uuid.UUID, found bool, err error) {
	guestID, found, err = s.session.GuestID(ctx)
	if err != nil {
		return uuid.Nil, false, fmt.Errorf("get guest ID from session: %w", err)
	}

	return guestID, found, nil
}

// ResolveOrCreateGuestは現在のGuest IDを返す。
// Guestが未発行の場合はGuestを作成し、現在のセッションへ紐づける。
func (s *GuestService) ResolveOrCreateGuest(ctx context.Context) (uuid.UUID, error) {
	guestID, found, err := s.ResolveGuest(ctx)
	if err != nil {
		return uuid.Nil, err
	}
	if found {
		return guestID, nil
	}

	guestID, err = s.repository.CreateGuest(ctx)
	if err != nil {
		return uuid.Nil, fmt.Errorf("create guest: %w", err)
	}

	if err := s.session.BindGuest(ctx, guestID); err != nil {
		return uuid.Nil, fmt.Errorf("bind guest to session: %w", err)
	}

	return guestID, nil
}
