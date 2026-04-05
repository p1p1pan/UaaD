package jwtutil

import (
	"testing"
	"time"
)

const testSecret = "test-secret-key"

func TestGenerateAndValidateToken(t *testing.T) {
	token, err := GenerateToken(42, "MERCHANT", testSecret, 1*time.Hour)
	if err != nil {
		t.Fatalf("generate failed: %v", err)
	}
	if token == "" {
		t.Fatal("empty token")
	}

	claims, err := ValidateToken(token, testSecret)
	if err != nil {
		t.Fatalf("validate failed: %v", err)
	}
	if claims.UserID != 42 {
		t.Errorf("user_id: got %d, want 42", claims.UserID)
	}
	if claims.Role != "MERCHANT" {
		t.Errorf("role: got %s, want MERCHANT", claims.Role)
	}
}

func TestExpiredToken(t *testing.T) {
	token, _ := GenerateToken(1, "USER", testSecret, -1*time.Hour) // already expired
	_, err := ValidateToken(token, testSecret)
	if err == nil {
		t.Error("expected error for expired token")
	}
}

func TestWrongSecret(t *testing.T) {
	token, _ := GenerateToken(1, "USER", testSecret, 1*time.Hour)
	_, err := ValidateToken(token, "wrong-secret")
	if err == nil {
		t.Error("expected error for wrong secret")
	}
}

func TestInvalidTokenString(t *testing.T) {
	_, err := ValidateToken("not.a.valid.token", testSecret)
	if err == nil {
		t.Error("expected error for invalid token string")
	}
}
