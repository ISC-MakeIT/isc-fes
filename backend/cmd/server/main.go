package main

import (
	"context"
	"log"
	"os"
	"os/signal"
	"syscall"

	"github.com/isc-makeit/isc-fes/backend/app"
	"github.com/isc-makeit/isc-fes/backend/app/config"
	"github.com/joho/godotenv"
)

func main() {
	if err := run(); err != nil {
		log.Printf("server stopped: %v", err)
		os.Exit(1)
	}
}

func run() error {
	_ = godotenv.Load()

	cfg := config.Load()

	ctx, stop := signal.NotifyContext(
		context.Background(),
		os.Interrupt,
		syscall.SIGTERM,
	)
	defer stop()

	application, err := app.New(ctx, cfg)
	if err != nil {
		return err
	}
	defer application.Close()

	return application.Run(ctx)
}
