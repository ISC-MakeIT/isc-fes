package routers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/services"
	reviewservice "github.com/isc-makeit/isc-fes/backend/services/reviews"
)

func (s *Server) CreateReview(c *gin.Context) {
	var body CreateReviewJSONRequestBody
	if err := c.ShouldBindJSON(&body); err != nil {
		s.handleCommonServiceErrors(c, services.ErrInvalidInput)
		return
	}
	input := reviewservice.CreateReviewInput{
		Rating:  body.Rating,
		Comment: body.Comment,
		Trigger: body.Trigger,
	}
	review, err := s.reviews.CreateReview(c.Request.Context(), input)
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}
	c.JSON(http.StatusCreated, toCreateReviewResponse(review))
}

func toCreateReviewResponse(review entities.Review) CreateReviewResponse {
	return CreateReviewResponse{Id: review.ID, CreatedAt: review.CreatedAt}
}
