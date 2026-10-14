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
		deps.stopSessionCleanup()
		deps.pool.Close()
		return nil, fmt.Errorf("initialize router: %w", err)
	}

	handler := guardSessionUpgrade(deps.accountSession.LoadAndSave(
		deps.guestSession.LoadAndSave(router),
	))

	httpServer := newHTTPServer(cfg.HTTP, handler)

	return &App{
		httpServer:   httpServer,
		dependencies: deps,
	}, nil
}

func (a *App) Close() {
	// Runで接続終了を待った後にDBを解放する。ここで終了期限を再延長しない。
	a.dependencies.ordersHub.Stop()
	a.dependencies.stopSessionCleanup()
	a.dependencies.pool.Close()
}
