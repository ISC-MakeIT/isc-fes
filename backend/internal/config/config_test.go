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
