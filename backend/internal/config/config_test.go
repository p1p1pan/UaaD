package config

import (
	"os"
	"testing"
)

func TestLoad_CORSAllowedOrigins(t *testing.T) {
	t.Setenv("CORS_ALLOWED_ORIGINS", "http://localhost:5173, https://uaad.example.com ,")
	t.Setenv("APP_ENV", "production")
	t.Setenv("STOCK_RECONCILE_MINUTES", "15")
	cfg := Load()

	if cfg.AppEnv != "production" {
		t.Fatalf("unexpected app env: %s", cfg.AppEnv)
	}
	if len(cfg.CORSAllowedOrigins) != 2 {
		t.Fatalf("unexpected origins length: %d", len(cfg.CORSAllowedOrigins))
	}
	if cfg.CORSAllowedOrigins[0] != "http://localhost:5173" {
		t.Fatalf("unexpected first origin: %s", cfg.CORSAllowedOrigins[0])
	}
	if cfg.CORSAllowedOrigins[1] != "https://uaad.example.com" {
		t.Fatalf("unexpected second origin: %s", cfg.CORSAllowedOrigins[1])
	}
	if cfg.StockReconcileMinutes != 15 {
		t.Fatalf("unexpected stock reconcile minutes: %d", cfg.StockReconcileMinutes)
	}
}

func TestLoad_EmptyOrigins(t *testing.T) {
	_ = os.Unsetenv("CORS_ALLOWED_ORIGINS")
	t.Setenv("APP_ENV", "development")
	cfg := Load()

	if cfg.AppEnv != "development" {
		t.Fatalf("unexpected app env: %s", cfg.AppEnv)
	}
	if len(cfg.CORSAllowedOrigins) != 0 {
		t.Fatalf("expected no cors origins, got: %v", cfg.CORSAllowedOrigins)
	}
}
