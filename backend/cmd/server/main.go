package main

import (
	"context"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/isc-makeit/isc-fes/backend/internal/api"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	// Create db connection
	pool, err := pgxpool.New(context.Background(), os.Getenv("DATABASE_URL"))
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	defer pool.Close()
	if err := pool.Ping(context.Background()); err != nil {
		log.Fatalf("db ping: %v", err)
	}
	log.Println("db connected")

	r := gin.Default()

	srv := api.NewServer(pool)
	api.RegisterHandlers(r, srv)

	log.Fatal(r.Run(":8080"))
}
