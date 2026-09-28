package main

import (
	"context"
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/getsentry/sentry-go"
	"github.com/isc-makeit/isc-fes/backend/app"
	"github.com/isc-makeit/isc-fes/backend/app/buildinfo"
	"github.com/isc-makeit/isc-fes/backend/app/config"
	"github.com/joho/godotenv"
)

func main() {
	if err := run(); err != nil {
		log.Printf("server stopped: %v", err)
		os.Exit(1)
	}
}

func run() (runErr error) {
	_ = godotenv.Load()

	cfg := config.Load()
	if err := sentry.Init(sentry.ClientOptions{
		Dsn:                     cfg.Sentry.DSN,
		Environment:             cfg.Sentry.Environment,
		Release:                 "backend@" + buildinfo.CommitHash,
		EnableTracing:           cfg.Sentry.DSN != "",
		TracesSampleRate:        cfg.Sentry.TracesSampleRate,
		StrictTraceContinuation: true,
		AttachStacktrace:        true,
		IgnoreTransactions:      []string{`^GET /health$`},
	}); err != nil {
		return fmt.Errorf("initialize Sentry: %w", err)
	}
	defer func() {
		if runErr != nil {
			sentry.CaptureException(runErr)
		}
		sentry.Flush(2 * time.Second)
	}()

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
