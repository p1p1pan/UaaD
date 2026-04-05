//go:build integration

// Integration tests that run against a live server at localhost:8080.
//
// Prerequisites:
//   1. Server running: cd backend && go run ./cmd/server
//   2. Seed data loaded: cd backend && go run ./scripts/seed
//
// Run:
//   cd backend && go test -v -tags=integration -count=1 ./tests/

package tests

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/uaad/backend/internal/domain"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

const baseURL = "http://localhost:8080/api/v1"

// ── helpers ─────────────────────────────────────────────────────────────────

func loginAndGetToken(t *testing.T, phone, password string) string {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"phone": phone, "password": password})
	resp, err := http.Post(baseURL+"/auth/login", "application/json", bytes.NewReader(body))
	if err != nil {
		t.Fatalf("login failed for %s: %v", phone, err)
	}
	defer resp.Body.Close()

	var result struct {
		Code int `json:"code"`
		Data struct {
			Token string `json:"token"`
		} `json:"data"`
	}
	json.NewDecoder(resp.Body).Decode(&result)
	if result.Data.Token == "" {
		t.Fatalf("no token for %s (code=%d)", phone, result.Code)
	}
	return result.Data.Token
}

func registerUserDB(t *testing.T, phone, username, password string) {
	t.Helper()
	db, err := gorm.Open(sqlite.Open("../uaad.db"), &gorm.Config{})
	if err != nil {
		t.Fatalf("failed to open db: %v", err)
	}
	sqlDB, _ := db.DB()
	defer sqlDB.Close()

	hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	user := domain.User{Phone: phone, Username: username, PasswordHash: string(hash), Role: "USER"}
	db.Where("phone = ?", phone).FirstOrCreate(&user)
}

func postJSON(url, token string, payload interface{}) (int, map[string]interface{}) {
	var bodyReader io.Reader
	if payload != nil {
		body, _ := json.Marshal(payload)
		bodyReader = bytes.NewReader(body)
	}
	req, _ := http.NewRequest("POST", url, bodyReader)
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

func putJSON(url, token string) (int, map[string]interface{}) {
	req, _ := http.NewRequest("PUT", url, nil)
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

func getJSON(url, token string) (int, map[string]interface{}) {
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

func createAndPublishActivity(t *testing.T, merchantToken string, maxCapacity int) uint64 {
	t.Helper()
	now := time.Now()
	_, createData := postJSON(baseURL+"/activities", merchantToken, map[string]interface{}{
		"title":           fmt.Sprintf("测试活动-cap%d-%d", maxCapacity, now.UnixMilli()),
		"description":     "自动化测试创建",
		"location":        "测试场馆",
		"category":        "CONCERT",
		"max_capacity":    maxCapacity,
		"price":           99.0,
		"enroll_open_at":  now.Add(-1 * time.Hour).Format(time.RFC3339),
		"enroll_close_at": now.Add(24 * time.Hour).Format(time.RFC3339),
		"activity_at":     now.Add(48 * time.Hour).Format(time.RFC3339),
	})
	dataMap, ok := createData["data"].(map[string]interface{})
	if !ok {
		t.Fatalf("创建活动失败: %v", createData)
	}
	activityID := uint64(dataMap["activity_id"].(float64))

	status, pubData := putJSON(fmt.Sprintf("%s/activities/%d/publish", baseURL, activityID), merchantToken)
	if status != 200 {
		t.Fatalf("上架失败: status=%d, data=%v", status, pubData)
	}
	return activityID
}

// =============================================================================
// Test 1: 并发抢票 — stock=1, 100 goroutine, 只有 1 个成功
// =============================================================================
func TestConcurrentEnrollment_Stock1(t *testing.T) {
	merchantToken := loginAndGetToken(t, "13800000004", "test123456")
	activityID := createAndPublishActivity(t, merchantToken, 1)
	t.Logf("活动 ID=%d, stock=1", activityID)

	const concurrency = 100
	tokens := make([]string, concurrency)
	for i := 0; i < concurrency; i++ {
		phone := fmt.Sprintf("166%08d", i+1)
		registerUserDB(t, phone, fmt.Sprintf("压测用户%d", i+1), "test123456")
		tokens[i] = loginAndGetToken(t, phone, "test123456")
	}
	t.Logf("注册并登录 %d 个用户", concurrency)

	var successCount, stockOutCount, otherCount atomic.Int32
	var wg sync.WaitGroup
	ready := make(chan struct{})

	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			<-ready
			_, data := postJSON(baseURL+"/enrollments", tokens[idx], map[string]uint64{"activity_id": activityID})
			code, _ := data["code"].(float64)
			switch int(code) {
			case 0, 1201:
				successCount.Add(1)
			case 1101:
				stockOutCount.Add(1)
			default:
				otherCount.Add(1)
			}
		}(i)
	}

	close(ready)
	wg.Wait()

	s, so, o := successCount.Load(), stockOutCount.Load(), otherCount.Load()
	t.Logf("结果: 成功=%d, 库存不足=%d, 其他=%d (共 %d)", s, so, o, concurrency)
	if s != 1 {
		t.Errorf("❌ 超卖! stock=1 但 %d 个成功", s)
	} else {
		t.Log("✅ 零超卖: stock=1, 恰好 1 成功")
	}
}

// =============================================================================
// Test 2: 报名幂等
// =============================================================================
func TestEnrollmentIdempotency(t *testing.T) {
	merchantToken := loginAndGetToken(t, "13800000004", "test123456")
	activityID := createAndPublishActivity(t, merchantToken, 100)
	userToken := loginAndGetToken(t, "13800000001", "test123456")

	status1, _ := postJSON(baseURL+"/enrollments", userToken, map[string]uint64{"activity_id": activityID})
	if status1 != 202 {
		t.Fatalf("第一次报名应 202, got %d", status1)
	}
	t.Log("✅ 第一次报名 202")

	status2, _ := postJSON(baseURL+"/enrollments", userToken, map[string]uint64{"activity_id": activityID})
	if status2 != 409 {
		t.Errorf("❌ 重复报名应 409, got %d", status2)
	} else {
		t.Log("✅ 重复报名 409")
	}
}

// =============================================================================
// Test 3: 库存不足
// =============================================================================
func TestEnrollmentStockInsufficient(t *testing.T) {
	merchantToken := loginAndGetToken(t, "13800000004", "test123456")
	activityID := createAndPublishActivity(t, merchantToken, 1)

	phone1 := fmt.Sprintf("177%08d", time.Now().UnixMilli()%100000000)
	registerUserDB(t, phone1, "抢票1", "test123456")
	token1 := loginAndGetToken(t, phone1, "test123456")
	postJSON(baseURL+"/enrollments", token1, map[string]uint64{"activity_id": activityID})

	phone2 := fmt.Sprintf("177%08d", time.Now().UnixMilli()%100000000+1)
	registerUserDB(t, phone2, "抢票2", "test123456")
	token2 := loginAndGetToken(t, phone2, "test123456")
	_, data := postJSON(baseURL+"/enrollments", token2, map[string]uint64{"activity_id": activityID})

	code, _ := data["code"].(float64)
	if int(code) != 1101 {
		t.Errorf("❌ 应返回 1101, got %.0f", code)
	} else {
		t.Log("✅ 库存不足 code=1101")
	}
}

// =============================================================================
// Test 4: 权限校验
// =============================================================================
func TestCreateActivityForbiddenForUser(t *testing.T) {
	userToken := loginAndGetToken(t, "13800000001", "test123456")
	status, _ := postJSON(baseURL+"/activities", userToken, map[string]interface{}{
		"title": "非法", "description": "x", "location": "x", "category": "CONCERT",
		"max_capacity": 100, "price": 10.0,
		"enroll_open_at":  time.Now().Add(1 * time.Hour).Format(time.RFC3339),
		"enroll_close_at": time.Now().Add(24 * time.Hour).Format(time.RFC3339),
		"activity_at":     time.Now().Add(48 * time.Hour).Format(time.RFC3339),
	})
	if status != 403 {
		t.Errorf("❌ 应 403, got %d", status)
	} else {
		t.Log("✅ 普通用户创建活动 403")
	}
}

// =============================================================================
// Test 5: 模拟支付
// =============================================================================
func TestOrderPayment(t *testing.T) {
	merchantToken := loginAndGetToken(t, "13800000004", "test123456")
	activityID := createAndPublishActivity(t, merchantToken, 100)

	phone := fmt.Sprintf("199%08d", time.Now().UnixMilli()%100000000)
	registerUserDB(t, phone, "支付用户", "test123456")
	userToken := loginAndGetToken(t, phone, "test123456")

	postJSON(baseURL+"/enrollments", userToken, map[string]uint64{"activity_id": activityID})

	_, ordersData := getJSON(baseURL+"/orders?page=1&page_size=10", userToken)
	dataInner, _ := ordersData["data"].(map[string]interface{})
	orderList, _ := dataInner["list"].([]interface{})
	if len(orderList) == 0 {
		t.Fatal("❌ 报名后无订单")
	}

	firstOrder := orderList[0].(map[string]interface{})
	orderID := uint64(firstOrder["id"].(float64))
	if firstOrder["status"] != "PENDING" {
		t.Fatalf("❌ 应 PENDING, got %s", firstOrder["status"])
	}
	t.Logf("订单 ID=%d PENDING ✅", orderID)

	_, payData := postJSON(fmt.Sprintf("%s/orders/%d/pay", baseURL, orderID), userToken, nil)
	payInner, _ := payData["data"].(map[string]interface{})
	if payInner["status"] != "PAID" {
		t.Errorf("❌ 应 PAID, got %v", payData)
	} else {
		t.Logf("✅ 支付成功: %s → PAID", payInner["order_no"])
	}
}
