package auth

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/alexedwards/scs/pgxstore"
	"github.com/alexedwards/scs/v2"
	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/services"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	guestIDKey = "guest_id"

	guestSessionLifetime    = 365 * 24 * time.Hour
	guestSessionRenewBefore = 30 * 24 * time.Hour
)

var (
	ErrInvalidGuestSession      = errors.New("invalid guest session")
	ErrGuestSessionAlreadyBound = errors.New("guest session is already bound")
)

// GuestSessionは、ブラウザ単位のGuest IDをAccountとは独立して管理する。
type GuestSession struct {
	manager *scs.SessionManager
}

func NewGuestSession(
	pool *pgxpool.Pool,
	secure bool,
	domain string,
) (*GuestSession, func()) {
	store := pgxstore.NewWithConfig(pool, pgxstore.Config{
		TableName:       "guest_sessions",
		CleanUpInterval: 5 * time.Minute,
	})

	manager := scs.New()
	manager.Store = store
	manager.HashTokenInStore = true
	manager.Lifetime = guestSessionLifetime
	manager.IdleTimeout = 0

	configureSessionCookie(
		manager,
		"isc_fes_guest_session",
		secure,
		domain,
	)

	return &GuestSession{manager: manager}, store.StopCleanup
}

// LoadAndSaveはGuestセッションを読み書きし、期限が近い有効なセッションだけ更新する。
// Guest IDが保存されていないリクエストではセッションを作成しない。
// 不正なGuest IDを含むセッションは破棄し、Guest未発行のリクエストとして処理を続ける。
func (s *GuestSession) LoadAndSave(next http.Handler) http.Handler {
	return s.manager.LoadAndSave(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		err := s.RenewIfNeeded(r.Context())
		if errors.Is(err, ErrInvalidGuestSession) {
			if err := s.manager.Destroy(r.Context()); err != nil {
				s.manager.ErrorFunc(w, r, fmt.Errorf("destroy invalid guest session: %w", err))
				return
			}
		} else if err != nil {
			s.manager.ErrorFunc(w, r, err)
			return
		}

		next.ServeHTTP(w, r)
	}))
}

// GuestIDはセッションに保存されたGuest IDを返す。
// Guest未発行または期限切れの場合はfound=falseを返す。
func (s *GuestSession) GuestID(ctx context.Context) (guestID uuid.UUID, found bool, err error) {
	value := s.manager.GetString(ctx, guestIDKey)
	if value == "" {
		return uuid.Nil, false, nil
	}

	guestID, err = uuid.Parse(value)
	if err != nil || guestID == uuid.Nil {
		return uuid.Nil, false, ErrInvalidGuestSession
	}

	return guestID, true, nil
}

// BindGuestは、作成済みのGuestを現在のセッションへ紐づける。
// Guestとその所有データをDBへコミットした後に呼び出す。
func (s *GuestSession) BindGuest(ctx context.Context, guestID uuid.UUID) error {
	if guestID == uuid.Nil {
		return fmt.Errorf("%w: guest ID is nil", ErrInvalidGuestSession)
	}

	currentGuestID, found, err := s.GuestID(ctx)
	if err != nil {
		return err
	}
	if found {
		if currentGuestID == guestID {
			return nil
		}

		return ErrGuestSessionAlreadyBound
	}

	// Guestへの紐づけ時にトークンを更新し、session fixationを防ぐ。
	if err := s.manager.RenewToken(ctx); err != nil {
		return fmt.Errorf("renew guest session token before binding: %w", err)
	}

	s.manager.Put(ctx, guestIDKey, guestID.String())
	return nil
}

// RenewIfNeededは、有効期限までの残り時間が短いGuestセッションの
// トークンをローテーションし、有効期限を延長する。
func (s *GuestSession) RenewIfNeeded(ctx context.Context) error {
	_, found, err := s.GuestID(ctx)
	if err != nil {
		return err
	}
	if !found || time.Until(s.manager.Deadline(ctx)) > guestSessionRenewBefore {
		return nil
	}

	if err := s.manager.RenewToken(ctx); err != nil {
		return fmt.Errorf("renew guest session token: %w", err)
	}

	return nil
}

var _ services.GuestSession = (*GuestSession)(nil)
