package reviews

import (
	"context"
	"fmt"

	db "github.com/isc-makeit/isc-fes/backend/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	reviewservice "github.com/isc-makeit/isc-fes/backend/services/reviews"
)

type ReviewRepository struct {
	queries *db.Queries
}

func NewReviewRepository(queries *db.Queries) *ReviewRepository {
	return &ReviewRepository{queries: queries}
}

func (r *ReviewRepository) CreateReview(ctx context.Context, input reviewservice.CreateReviewRepositoryInput) (entities.Review, error) {
	review, err := r.queries.CreateReview(ctx, db.CreateReviewParams{
		GuestID:   input.GuestID,
		AccountID: input.AccountID,
		Rating:    input.Rating,
		Comment:   input.Comment,
		Trigger:   input.Trigger,
	})
	if err != nil {
		return entities.Review{}, fmt.Errorf("create review: %w", err)
	}
	return entities.Review{
		ID:        review.ID,
		GuestID:   review.GuestID,
		AccountID: review.AccountID,
		Rating:    review.Rating,
		Comment:   review.Comment,
		Trigger:   review.Trigger,
		CreatedAt: review.CreatedAt.Time,
	}, nil
}

var _ reviewservice.ReviewRepository = (*ReviewRepository)(nil)
