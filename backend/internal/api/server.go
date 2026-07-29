package api

import (
	"github.com/isc-makeit/isc-fes/backend/internal/auth"
	db "github.com/isc-makeit/isc-fes/backend/internal/db/sqlc"
)

type Server struct {
	queries             *db.Queries
	sessions            *auth.Sessions
	googleAuthenticator *auth.GoogleAuthenticator
	frontendURL         string
}

func NewServer(
	queries *db.Queries,
	sessions *auth.Sessions,
	googleAuthenticator *auth.GoogleAuthenticator,
	frontendURL string,
) *Server {
	return &Server{
		queries:             queries,
		sessions:            sessions,
		googleAuthenticator: googleAuthenticator,
		frontendURL:         frontendURL,
	}
}
