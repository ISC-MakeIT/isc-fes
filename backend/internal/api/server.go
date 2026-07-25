package api

import "github.com/jackc/pgx/v5/pgxpool"

type Server struct {
	pool *pgxpool.Pool
}

func NewServer(pool *pgxpool.Pool) *Server {
	return &Server{pool: pool}
}
