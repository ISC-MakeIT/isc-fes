package reviews

import (
	"context"

	"github.com/google/uuid"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
)

type CreateReviewRepositoryInput struct {
	GuestID   *uuid.UUID
	AccountID *uuid.UUID
	Rating    int32
	Comment   *string
	Trigger   *string
}

type ReviewRepository interface {
	CreateReview(context.Context, CreateReviewRepositoryInput) (entities.Review, error)
}
