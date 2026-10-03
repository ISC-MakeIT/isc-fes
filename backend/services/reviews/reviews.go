package reviews

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/services"
)

// GuestResolverは、既存のゲストセッションだけを読み取り、新規発行しない。
type GuestResolver interface {
	ResolveGuest(context.Context) (uuid.UUID, bool, error)
}

type CurrentAccountLoader interface {
	GetCurrentAccount(context.Context) (entities.Account, error)
}

type ReviewService struct {
	repository    ReviewRepository
	guestResolver GuestResolver
	accountLoader CurrentAccountLoader
}

func NewReviewService(repository ReviewRepository, guestResolver GuestResolver, accountLoader CurrentAccountLoader) *ReviewService {
	return &ReviewService{repository: repository, guestResolver: guestResolver, accountLoader: accountLoader}
}

type CreateReviewInput struct {
	Rating  int32
	Comment *string
	Trigger *string
}

func (s *ReviewService) CreateReview(ctx context.Context, input CreateReviewInput) (entities.Review, error) {
	if err := input.Validate(); err != nil {
		return entities.Review{}, err
	}
	review := CreateReviewRepositoryInput{
		Rating:  input.Rating,
		Comment: normalizeOptionalText(input.Comment),
		Trigger: normalizeOptionalText(input.Trigger),
	}
	// 投稿元はtriggerに残し、セッションがある場合だけ分析用のIDを付ける。
	guestID, found, err := s.guestResolver.ResolveGuest(ctx)
	if err != nil {
		return entities.Review{}, fmt.Errorf("resolve review guest: %w", err)
	}
	if found && guestID != uuid.Nil {
		review.GuestID = &guestID
	}
	account, err := s.accountLoader.GetCurrentAccount(ctx)
	if err != nil && !errors.Is(err, services.ErrUnauthenticated) {
		return entities.Review{}, fmt.Errorf("resolve review account: %w", err)
	}
	if err == nil && account.ID != uuid.Nil {
		review.AccountID = &account.ID
	}
	return s.repository.CreateReview(ctx, review)
}

func (input CreateReviewInput) Validate() error {
	if input.Rating < 1 || input.Rating > 5 {
		return services.ErrInvalidInput
	}
	for _, field := range []struct {
		value *string
		max   int
	}{
		{input.Comment, 1000},
		{input.Trigger, 100},
	} {
		if field.value != nil {
			value := *field.value
			// PostgreSQLの文字列型に保存できないNUL文字も入力エラーにする。
			if !utf8.ValidString(value) || strings.ContainsRune(value, '\x00') || utf8.RuneCountInString(value) > field.max {
				return services.ErrInvalidInput
			}
		}
	}
	return nil
}

func normalizeOptionalText(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}
