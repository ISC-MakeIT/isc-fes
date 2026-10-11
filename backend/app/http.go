package app

import (
	"context"
	"errors"
	"net/http"
	"time"

	"github.com/isc-makeit/isc-fes/backend/app/config"
)

func newHTTPServer(
	cfg config.HTTPConfig,
	handler http.Handler,
) *http.Server {
	return &http.Server{
		Addr:              cfg.Addr,
		Handler:           handler,
		ReadHeaderTimeout: cfg.ReadHeaderTimeout,
		ReadTimeout:       cfg.ReadTimeout,
		WriteTimeout:      cfg.WriteTimeout,
		IdleTimeout:       cfg.IdleTimeout,
	}
}

func (a *App) Run(ctx context.Context) error {
	errCh := make(chan error, 1)

	go func() {
		errCh <- a.httpServer.ListenAndServe()
	}()

	var serveErr error
	select {
	case serveErr = <-errCh:
		if errors.Is(serveErr, http.ErrServerClosed) {
			serveErr = nil
		}
	case <-ctx.Done():
	}
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	return errors.Join(serveErr, a.shutdown(shutdownCtx))
}

func (a *App) shutdown(ctx context.Context) error {
	// HTTP受付停止とWS終了は、同じ期限で並行して行う。
	a.dependencies.ordersHub.Stop()
	webSocketDone := make(chan error, 1)
	go func() { webSocketDone <- a.dependencies.ordersHub.Shutdown(ctx) }()
	httpErr := a.httpServer.Shutdown(ctx)
	if httpErr != nil {
		_ = a.httpServer.Close()
	}
	return errors.Join(httpErr, <-webSocketDone)
}
