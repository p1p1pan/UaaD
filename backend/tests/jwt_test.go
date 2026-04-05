//go:build bgroup

// JWT middleware HTTP black-box tests (Authorization header branches).
//
// Prerequisites:
//   1. Server running: cd backend && go run ./cmd/server
//   2. Seed data loaded: cd backend && go run ./scripts/seed
//   3. JWT_SECRET in .env must match the running server (for signed-token cases).
//
// Run:
//   cd backend && go test -v -tags=bgroup -run '^TestJWT' -count=1 ./tests/

package tests

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/uaad/backend/internal/config"
	"github.com/uaad/backend/pkg/jwtutil"
)

const jwtBaseURL = "http://localhost:8080/api/v1"

func jwtLoginToken(t *testing.T, phone, password string) string {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"phone": phone, "password": password})
	resp, err := http.Post(jwtBaseURL+"/auth/login", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("login: %v", err)
	}
	defer resp.Body.Close()
	var out struct {
		Code int `json:"code"`
		Data struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	json.NewDecoder(resp.Body).Decode(&out)
	if out.Data.Token == "" {
		t.Fatalf("no token (code=%d)", out.Code)
	}
	return out.Data.Token
}

func jwtGetOrders(t *testing.T, authHeader string) (int, map[string]interface{}) {
	t.Helper()
	req, _ := http.NewRequest("GET", jwtBaseURL+"/orders?page=1&page_size=1", nil)
	if authHeader != "" {
		req.Header.Set("Authorization", authHeader)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request: %v", err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	var data map[string]interface{}
	json.Unmarshal(b, &data)
	return resp.StatusCode, data
}

func assertJWT401(t *testing.T, st int, body map[string]interface{}) {
	t.Helper()
	if st != 401 {
		t.Fatalf("HTTP: got %d, want 401", st)
	}
	code, _ := body["code"].(float64)
	if code != 1002 {
		t.Fatalf("code: got %v, want 1002", body["code"])
	}
	if body["data"] != nil {
		t.Fatalf("data: want null")
	}
	msg, _ := body["message"].(string)
	if strings.TrimSpace(msg) == "" {
		t.Fatalf("message empty")
	}
}

func TestJWT_MissingHeader(t *testing.T) {
	st, body := jwtGetOrders(t, "")
	assertJWT401(t, st, body)
}

func TestJWT_NotBearer(t *testing.T) {
	st, body := jwtGetOrders(t, "Token x")
	assertJWT401(t, st, body)
}

func TestJWT_BearerOnly(t *testing.T) {
	st, body := jwtGetOrders(t, "Bearer")
	assertJWT401(t, st, body)
}

func TestJWT_Malformed(t *testing.T) {
	st, body := jwtGetOrders(t, "Bearer not-a-jwt")
	assertJWT401(t, st, body)
}

func TestJWT_WrongSecret(t *testing.T) {
	tok, err := jwtutil.GenerateToken(1, "USER", "wrong-secret-for-test", time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	st, body := jwtGetOrders(t, "Bearer "+tok)
	assertJWT401(t, st, body)
}

func TestJWT_Expired(t *testing.T) {
	cfg := config.Load()
	tok, err := jwtutil.GenerateToken(1, "USER", cfg.JWTSecret, -time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	st, body := jwtGetOrders(t, "Bearer "+tok)
	assertJWT401(t, st, body)
}

func TestJWT_ValidToken(t *testing.T) {
	tok := jwtLoginToken(t, "13800000001", "test123456")
	st, body := jwtGetOrders(t, "Bearer "+tok)
	if st != 200 {
		t.Fatalf("HTTP: got %d, body=%v", st, body)
	}
	code, _ := body["code"].(float64)
	if code != 0 {
		t.Fatalf("code: got %v", body["code"])
	}
}
