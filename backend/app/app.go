package app

import (
	"context"
	"net/http"

	"github.com/isc-makeit/isc-fes/backend/api"
	"github.com/isc-makeit/isc-fes/backend/config"
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

	router := api.NewRouter(
		deps.apiServer,
		cfg.HTTP.CORSAllowedOrigins,
	)

	handler := deps.sessions.LoadAndSave(router)

	httpServer := newHTTPServer(cfg.HTTP, handler)

	return &App{
		httpServer:   httpServer,
		dependencies: deps,
	}, nil
}

func (a *App) Close() {
	a.dependencies.stopSessionCleanup()
	a.dependencies.pool.Close()
}
