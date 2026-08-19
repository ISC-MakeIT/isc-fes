package routers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/isc-makeit/isc-fes/backend/domains/entities"
	"github.com/isc-makeit/isc-fes/backend/utils"
)

func (s *Server) GetAllergens(c *gin.Context) {
	allergens, err := s.allergen.GetAllergens(c.Request.Context())
	if err != nil {
		s.handleCommonServiceErrors(c, err)
		return
	}

	c.JSON(http.StatusOK, GetAllergensResponse{
		Total: len(allergens),
		Data:  utils.Map(allergens, toAllergen),
	})
}

func toAllergen(allergen entities.Allergen) Allergen {
	return Allergen{
		Id:   allergen.ID,
		Name: allergen.Name,
	}
}
