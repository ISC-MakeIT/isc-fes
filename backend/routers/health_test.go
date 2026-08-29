package routers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/isc-makeit/isc-fes/backend/app/buildinfo"
)

func TestGetHealthReturnsBuildInformation(t *testing.T) {
	previousCommitHash := buildinfo.CommitHash
	previousDeployedAt := buildinfo.DeployedAt
	t.Cleanup(func() {
		buildinfo.CommitHash = previousCommitHash
		buildinfo.DeployedAt = previousDeployedAt
	})

	buildinfo.CommitHash = "0123456789abcdef0123456789abcdef01234567"
	buildinfo.DeployedAt = "2026-08-29T12:34:56Z"

	response := httptest.NewRecorder()
	context, _ := gin.CreateTestContext(response)
	context.Request = httptest.NewRequestWithContext(t.Context(), http.MethodGet, "/health", nil)

	server := &Server{}
	server.GetHealth(context)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", response.Code, http.StatusOK)
	}

	var body HealthResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}

	wantDeployedAt := time.Date(2026, time.August, 29, 12, 34, 56, 0, time.UTC)
	if body.Status != "ok" {
		t.Errorf("Status = %q, want %q", body.Status, "ok")
	}
	if body.CommitHash != buildinfo.CommitHash {
		t.Errorf("CommitHash = %q, want %q", body.CommitHash, buildinfo.CommitHash)
	}
	if !body.DeployedAt.Equal(wantDeployedAt) {
		t.Errorf("DeployedAt = %s, want %s", body.DeployedAt, wantDeployedAt)
	}
}
