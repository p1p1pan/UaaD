//go:build bgroup

// Unified response envelope HTTP black-box tests (code / message / data for common errors). Complements pkg/response unit tests; helpers are local to this file.
//
// Prerequisites:
//   1. Server running: cd backend && go run ./cmd/server
//   2. Seed data loaded: cd backend && go run ./scripts/seed
//
// Run:
//   cd backend && go test -v -tags=bgroup -run '^TestResponse' -count=1 ./tests/

package tests

import (
	"bytes"
	"encoding/json"
	"io"
	"net/http"
	"testing"
)

const respBaseURL = "http://localhost:8080/api/v1"

func respPostJSON(url, token string, payload interface{}) (int, map[string]interface{}) {
	var r io.Reader
	if payload != nil {
		b, _ := json.Marshal(payload)
		r = bytes.NewReader(b)
	}
	req, _ := http.NewRequest("POST", url, r)
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, nil
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	var data map[string]interface{}
	json.Unmarshal(b, &data)
	return resp.StatusCode, data
}

func respGetJSON(url, token string) (int, map[string]interface{}) {
	req, _ := http.NewRequest("GET", url, nil)
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, nil
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	var data map[string]interface{}
	json.Unmarshal(b, &data)
	return resp.StatusCode, data
}

func respLoginToken(t *testing.T, phone, password string) string {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"phone": phone, "password": password})
	resp, err := http.Post(respBaseURL+"/auth/login", "application/json", bytes.NewReader(body))
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

func assertErrEnvelope(t *testing.T, body map[string]interface{}, wantCode float64) {
	t.Helper()
	code, ok := body["code"].(float64)
	if !ok || code != wantCode {
		t.Fatalf("code: got %v, want %.0f", body["code"], wantCode)
	}
	msg, ok := body["message"].(string)
	if !ok || msg == "" {
		t.Fatalf("message: %v", body["message"])
	}
	if body["data"] != nil {
		t.Fatalf("data: want null, got %v", body["data"])
	}
}

func TestResponse_ListOK(t *testing.T) {
	st, body := respGetJSON(respBaseURL+"/activities?page=1&page_size=2", "")
	if st != 200 {
		t.Fatalf("HTTP %d %v", st, body)
	}
	code, ok := body["code"].(float64)
	if !ok || code != 0 {
		t.Fatalf("code: %v", body["code"])
	}
	data, ok := body["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("data: %T", body["data"])
	}
	if _, ok := data["list"]; !ok {
		t.Fatalf("data.list: %v", data)
	}
}

func TestResponse_BadRequest_Login(t *testing.T) {
	resp, err := http.Post(respBaseURL+"/auth/login", "application/json", bytes.NewReader([]byte(`{}`)))
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	var body map[string]interface{}
	json.NewDecoder(resp.Body).Decode(&body)
	if resp.StatusCode != 400 {
		t.Fatalf("HTTP %d", resp.StatusCode)
	}
	assertErrEnvelope(t, body, 1001)
}

func TestResponse_Unauthorized_Orders(t *testing.T) {
	st, body := respGetJSON(respBaseURL+"/orders?page=1&page_size=1", "")
	if st != 401 {
		t.Fatalf("HTTP %d", st)
	}
	assertErrEnvelope(t, body, 1002)
}

func TestResponse_Forbidden_CreateActivity(t *testing.T) {
	tok := respLoginToken(t, "13800000001", "test123456")
	st, body := respPostJSON(respBaseURL+"/activities", tok, map[string]interface{}{
		"title": "x", "description": "x", "location": "x", "category": "CONCERT",
		"max_capacity": 10, "price": 1.0,
		"enroll_open_at":  "2099-01-01T00:00:00Z",
		"enroll_close_at": "2099-06-01T00:00:00Z",
		"activity_at":     "2099-12-01T00:00:00Z",
	})
	if st != 403 {
		t.Fatalf("HTTP %d", st)
	}
	assertErrEnvelope(t, body, 1003)
}

func TestResponse_NotFound_Activity(t *testing.T) {
	st, body := respGetJSON(respBaseURL+"/activities/999999999999999999", "")
	if st != 404 {
		t.Fatalf("HTTP %d", st)
	}
	assertErrEnvelope(t, body, 1004)
}

func TestResponse_Conflict_Register(t *testing.T) {
	st, body := respPostJSON(respBaseURL+"/auth/register", "", map[string]string{
		"phone":    "13800000001",
		"username": "dup",
		"password": "test123456",
	})
	if st != 409 {
		t.Fatalf("HTTP %d", st)
	}
	assertErrEnvelope(t, body, 1005)
}
