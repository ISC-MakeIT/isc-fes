package main

import (
	"context"
	"log"
	"net/http"
	"os"

	"github.com/gin-gonic/gin"
	"github.com/isc-makeit/isc-fes/backend/internal/api"
	"github.com/isc-makeit/isc-fes/backend/internal/auth"
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

	secure := os.Getenv("SESSION_COOKIE_SECURE") == "true"
	sessions, stopSessionCleanup := auth.NewSessions(pool, secure)
	defer stopSessionCleanup()

	googleAuthenticator, err := auth.NewGoogleAuthenticator(
		context.Background(),
		auth.GoogleConfig{
			ClientID:     os.Getenv("GOOGLE_CLIENT_ID"),
			ClientSecret: os.Getenv("GOOGLE_CLIENT_SECRET"),
			RedirectURL:  os.Getenv("GOOGLE_REDIRECT_URL"),
		},
	)
	if err != nil {
		log.Fatalf("initialize Google authentication: %v", err)
	}

	r := gin.Default()

	srv := api.NewServer(pool, sessions, googleAuthenticator)

	api.RegisterHandlers(r, srv)
	api.RegisterAuthRoutes(r, srv)

	handler := sessions.LoadAndSave(r)

	httpServer := &http.Server{
		Addr:    ":8080",
		Handler: handler,
	}

	log.Fatal(httpServer.ListenAndServe())
}
