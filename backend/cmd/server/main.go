package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/isc-makeit/isc-fes/backend/internal/api"
	"github.com/isc-makeit/isc-fes/backend/internal/auth"
	db "github.com/isc-makeit/isc-fes/backend/internal/db/sqlc"
	"github.com/isc-makeit/isc-fes/backend/internal/repository"
	"github.com/isc-makeit/isc-fes/backend/internal/service"
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

	queries := db.New(pool)

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

	frontendURL := os.Getenv("FRONTEND_URL")
	if frontendURL == "" {
		log.Fatal("FRONTEND_URL is required")
	}

	r := gin.New()
	r.Use(gin.LoggerWithConfig(gin.LoggerConfig{
		SkipQueryString: true, // URL の Query がログに出ないようになる。/callback などで code, state などが出ないように
	}))

	r.Use(gin.Recovery())

	r.Use(cors.New(cors.Config{
		AllowOrigins: []string{
			frontendURL,
		},
		AllowMethods: []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPatch,
			http.MethodDelete,
			http.MethodOptions,
		},
		AllowHeaders: []string{
			"Origin",
			"Content-Type",
			"Accept",
		},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// Initialize repositories
	accountRepository := repository.NewAccountRepository(queries)

	// Initialize services
	accountService := service.NewAccountService(accountRepository, sessions)
	authService := service.NewAuthService(googleAuthenticator, sessions, accountRepository)

	srv := api.NewServer(queries, sessions, googleAuthenticator, frontendURL, accountService, authService)

	api.RegisterHandlers(r, srv)
	api.RegisterAuthRoutes(r, srv)

	handler := sessions.LoadAndSave(r)

	httpServer := &http.Server{
		Addr:              ":8080",
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	log.Fatal(httpServer.ListenAndServe())
}
