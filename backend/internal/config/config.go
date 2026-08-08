package config

import (
	"os"
	"strings"
	"time"
)

type Config struct {
	HTTP     HTTPConfig
	Database DatabaseConfig
	S3       S3Config
	Auth     AuthConfig

	FrontendURL       string
	StoreImageBaseURL string
}

type HTTPConfig struct {
	Addr               string
	ReadHeaderTimeout  time.Duration
	ReadTimeout        time.Duration
	WriteTimeout       time.Duration
	IdleTimeout        time.Duration
	CORSAllowedOrigins []string
}

type DatabaseConfig struct {
	Url string
}

type AuthConfig struct {
	SessionCookieSecure bool

	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string
}

type S3Config struct {
	Region       string
	Bucket       string
	UsePathStyle bool
	Endpoint     string
	UrlExpiresIn time.Duration
}

func Load() Config {
	return Config{
		HTTP: HTTPConfig{
			Addr:               ":8080",
			ReadHeaderTimeout:  5 * time.Second,
			ReadTimeout:        15 * time.Second,
			WriteTimeout:       30 * time.Second,
			IdleTimeout:        60 * time.Second,
			CORSAllowedOrigins: requireCSVEnv("CORS_ALLOWED_ORIGINS"),
		},
		Database: DatabaseConfig{
			Url: requireEnv("DATABASE_URL"),
		},
		S3: S3Config{
			Region:       requireEnv("AWS_REGION"),
			Bucket:       requireEnv("S3_BUCKET"),
			UsePathStyle: optionalBoolEnv("S3_USE_PATH_STYLE", false),
			Endpoint:     os.Getenv("S3_ENDPOINT"),
			UrlExpiresIn: 15 * time.Minute,
		},
		Auth: AuthConfig{
			SessionCookieSecure: optionalBoolEnv("SESSION_COOKIE_SECURE", true),
			GoogleClientID:      requireEnv("GOOGLE_CLIENT_ID"),
			GoogleClientSecret:  requireEnv("GOOGLE_CLIENT_SECRET"),
			GoogleRedirectURL:   requireEnv("GOOGLE_REDIRECT_URL"),
		},
		FrontendURL:       requireEnv("FRONTEND_URL"),
		StoreImageBaseURL: os.Getenv("STORE_IMAGE_BASE_URL"),
	}
}

// 必須のカンマ区切り環境変数を取り出す
func requireCSVEnv(key string) []string {
	values := strings.Split(requireEnv(key), ",")

	for i, value := range values {
		values[i] = strings.TrimSpace(value)
		if values[i] == "" {
			panic("environment variable " + key + " must not contain empty values")
		}
	}

	return values
}

// 必須の環境変数を取り出す
// 空文字（未設定）の場合は panic
func requireEnv(key string) string {
	v := os.Getenv(key)
	if v == "" {
		panic("environment variable " + key + " is required")
	}
	return v
}

// 任意の bool 環境変数を取り出す
// 未設定の場合は defaultValue を返す
// 設定値が true/1/yes なら true、false/0/no なら false を返す
// それ以外の値の場合は panic
func optionalBoolEnv(key string, defaultValue bool) bool {
	v := os.Getenv(key)
	if v == "" {
		return defaultValue
	}
	switch v {
	case "true", "1", "yes":
		return true
	case "false", "0", "no":
		return false
	default:
		panic("environment variable " + key + " must be a boolean value")
	}
}
