package routers

import (
	"errors"
	"net/http/httptest"
	"testing"

	"github.com/getsentry/sentry-go"
	"github.com/getsentry/sentry-go/gin"
	"github.com/gin-gonic/gin"
)

func TestCaptureUnexpectedErrorUsesRequestHub(t *testing.T) {
	gin.SetMode(gin.TestMode)
	transport := &sentry.MockTransport{}
	client, err := sentry.NewClient(sentry.ClientOptions{
		Dsn:       "https://public@example.com/1",
		Transport: transport,
	})
	if err != nil {
		t.Fatalf("sentry.NewClient() error = %v", err)
	}
	hub := sentry.NewHub(client, sentry.NewScope())
	context, _ := gin.CreateTestContext(httptest.NewRecorder())
	sentrygin.SetHubOnContext(context, hub)

	want := errors.New("unexpected failure")
	captureUnexpectedError(context, want)

	events := transport.Events()
	if len(events) != 1 {
		t.Fatalf("captured events = %d, want 1", len(events))
	}
	if got := events[0].Exception[0].Value; got != want.Error() {
		t.Errorf("captured error = %q, want %q", got, want.Error())
	}
}
