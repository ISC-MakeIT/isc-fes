package buildinfo

import (
	"testing"
	"time"
)

func TestDeploymentTimeParsesInjectedTimestamp(t *testing.T) {
	previousDeployedAt := DeployedAt
	t.Cleanup(func() { DeployedAt = previousDeployedAt })

	DeployedAt = "2026-08-29T12:34:56Z"
	want := time.Date(2026, time.August, 29, 12, 34, 56, 0, time.UTC)

	if got := DeploymentTime(); !got.Equal(want) {
		t.Errorf("DeploymentTime() = %s, want %s", got, want)
	}
}

func TestDeploymentTimeFallsBackToProcessStartTime(t *testing.T) {
	previousDeployedAt := DeployedAt
	t.Cleanup(func() { DeployedAt = previousDeployedAt })

	DeployedAt = ""

	if got := DeploymentTime(); !got.Equal(startedAt) {
		t.Errorf("DeploymentTime() = %s, want %s", got, startedAt)
	}
}
