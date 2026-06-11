package middleware

import "testing"

func TestBuildCORSConfig_DevelopmentAllowAllFallback(t *testing.T) {
	cfg := BuildCORSConfig("development", nil)
	if !cfg.AllowAllOrigins {
		t.Fatal("development should allow all origins when whitelist is empty")
	}
}

func TestBuildCORSConfig_ProductionDenyAllFallback(t *testing.T) {
	cfg := BuildCORSConfig("production", nil)
	if cfg.AllowAllOrigins {
		t.Fatal("production should not allow all origins when whitelist is empty")
	}
	if len(cfg.AllowOrigins) != 0 {
		t.Fatalf("expected empty allow origins, got %v", cfg.AllowOrigins)
	}
}

func TestBuildCORSConfig_Whitelist(t *testing.T) {
	origins := []string{"https://a.example.com", "https://b.example.com"}
	cfg := BuildCORSConfig("production", origins)
	if cfg.AllowAllOrigins {
		t.Fatal("allow all should be false when whitelist is provided")
	}
	if len(cfg.AllowOrigins) != 2 {
		t.Fatalf("unexpected allow origins length: %d", len(cfg.AllowOrigins))
	}
	if cfg.AllowOrigins[0] != "https://a.example.com" || cfg.AllowOrigins[1] != "https://b.example.com" {
		t.Fatalf("unexpected allow origins: %v", cfg.AllowOrigins)
	}
}
