package api

import (
	"github.com/isc-makeit/isc-fes/backend/internal/auth"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Server struct {
	pool                *pgxpool.Pool
	sessions            *auth.Sessions
	googleAuthenticator *auth.GoogleAuthenticator
}

func NewServer(pool *pgxpool.Pool, sessions *auth.Sessions, googleAuthenticator *auth.GoogleAuthenticator) *Server {
	return &Server{pool: pool, sessions: sessions, googleAuthenticator: googleAuthenticator}
}
