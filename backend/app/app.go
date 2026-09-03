package app

import (
	"context"
	"fmt"
	"net/http"

	"github.com/isc-makeit/isc-fes/backend/app/config"
	"github.com/isc-makeit/isc-fes/backend/routers"
)

type App struct {
	httpServer   *http.Server
	dependencies *dependencies
}

func New(ctx context.Context, cfg config.Config) (*App, error) {
	deps, err := buildDependencies(ctx, cfg)
	if err != nil {
		return nil, err
	}

	router, err := routers.NewRouter(
		deps.apiServer,
		cfg.HTTP.CORSAllowedOrigins,
	)
	if err != nil {
		deps.stopAccountSessionCleanup()
		deps.pool.Close()
		return nil, fmt.Errorf("initialize router: %w", err)
	}

	handler := deps.accountSession.LoadAndSave(router)

	httpServer := newHTTPServer(cfg.HTTP, handler)

	return &App{
		httpServer:   httpServer,
		dependencies: deps,
	}, nil
}

func (a *App) Close() {
	a.dependencies.stopAccountSessionCleanup()
	a.dependencies.pool.Close()
}
