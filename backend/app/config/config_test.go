package config

import (
	"reflect"
	"testing"
)

func TestRequireCSVEnv(t *testing.T) {
	t.Setenv("TEST_ORIGINS", "http://localhost:3000, http://localhost:8082")

	got := requireCSVEnv("TEST_ORIGINS")
	want := []string{"http://localhost:3000", "http://localhost:8082"}

	if !reflect.DeepEqual(got, want) {
		t.Errorf("requireCSVEnv() = %v, want %v", got, want)
	}
}

func TestRequireCSVEnvRejectsEmptyValue(t *testing.T) {
	t.Setenv("TEST_ORIGINS", "http://localhost:3000,")

	defer func() {
		if recover() == nil {
			t.Error("requireCSVEnv() did not panic")
		}
	}()

	requireCSVEnv("TEST_ORIGINS")
}

func TestSentryEnvironmentDefaultsToDev(t *testing.T) {
	t.Setenv("SENTRY_ENVIRONMENT", "")
	if got := sentryEnvironment(); got != "dev" {
		t.Errorf("sentryEnvironment() = %q, want dev", got)
	}
}

func TestSentryEnvironmentRejectsUnknownEnvironment(t *testing.T) {
	t.Setenv("SENTRY_ENVIRONMENT", "production")

	defer func() {
		if recover() == nil {
			t.Error("sentryEnvironment() did not panic")
		}
	}()

	sentryEnvironment()
}

func TestOptionalFloatEnvRejectsOutOfRangeValue(t *testing.T) {
	t.Setenv("SENTRY_TRACES_SAMPLE_RATE", "1.1")

	defer func() {
		if recover() == nil {
			t.Error("optionalFloatEnv() did not panic")
		}
	}()

	optionalFloatEnv("SENTRY_TRACES_SAMPLE_RATE", 1)
}
