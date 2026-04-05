//go:build bgroup

// B-group end-to-end black-box tests (enrollment, activity, orders). Independent from integration_test.go (A-group tag `integration`).
//
// Prerequisites:
//   1. Server running: cd backend && go run ./cmd/server
//   2. Seed data loaded: cd backend && go run ./scripts/seed
//
// Run:
//   cd backend && go test -v -tags=bgroup -run '^TestBGroup' -count=1 ./tests/
//   cd backend && go test -v -tags=bgroup -count=1 ./tests/

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
)

const bgroupBaseURL = "http://localhost:8080/api/v1"

func bgroupLoginAndGetToken(t *testing.T, phone, password string) string {
	t.Helper()
	body, _ := json.Marshal(map[string]string{"phone": phone, "password": password})
	resp, err := http.Post(bgroupBaseURL+"/auth/login", "application/json", bytes.NewReader(body))
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

func bgroupRegisterUserDB(t *testing.T, phone, username, password string) {
	t.Helper()
	db := openTestDB(t)
	sqlDB, _ := db.DB()
	defer sqlDB.Close()
	hash, _ := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	user := domain.User{Phone: phone, Username: username, PasswordHash: string(hash), Role: "USER"}
	db.Where("phone = ?", phone).FirstOrCreate(&user)
}

func bgroupPostJSON(url, token string, payload interface{}) (int, map[string]interface{}) {
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

func bgroupPutJSON(url, token string) (int, map[string]interface{}) {
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

func bgroupGetJSON(url, token string) (int, map[string]interface{}) {
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

func bgroupCreateAndPublishActivity(t *testing.T, merchantToken string, maxCapacity int) uint64 {
	t.Helper()
	now := time.Now()
	_, createData := bgroupPostJSON(bgroupBaseURL+"/activities", merchantToken, map[string]interface{}{
		"title":           fmt.Sprintf("B组测试-cap%d-%d", maxCapacity, now.UnixMilli()),
		"description":     "bgroup e2e",
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
	status, pubData := bgroupPutJSON(fmt.Sprintf("%s/activities/%d/publish", bgroupBaseURL, activityID), merchantToken)
	if status != 200 {
		t.Fatalf("上架失败: status=%d, data=%v", status, pubData)
	}
	return activityID
}

func TestBGroup_ConcurrentEnrollment_Stock1(t *testing.T) {
	merchantToken := bgroupLoginAndGetToken(t, "13800000004", "test123456")
	activityID := bgroupCreateAndPublishActivity(t, merchantToken, 1)

	const concurrency = 100
	tokens := make([]string, concurrency)
	for i := 0; i < concurrency; i++ {
		phone := fmt.Sprintf("166%08d", i+20000)
		bgroupRegisterUserDB(t, phone, fmt.Sprintf("B压测%d", i+1), "test123456")
		tokens[i] = bgroupLoginAndGetToken(t, phone, "test123456")
	}

	var successCount, stockOutCount, otherCount atomic.Int32
	var wg sync.WaitGroup
	ready := make(chan struct{})
	for i := 0; i < concurrency; i++ {
		wg.Add(1)
		go func(idx int) {
			defer wg.Done()
			<-ready
			_, data := bgroupPostJSON(bgroupBaseURL+"/enrollments", tokens[idx], map[string]uint64{"activity_id": activityID})
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

	if successCount.Load() != 1 {
		t.Errorf("stock=1 时期望恰好 1 个成功，得到成功=%d 库存不足=%d 其他=%d",
			successCount.Load(), stockOutCount.Load(), otherCount.Load())
	}
}

func TestBGroup_ActivityCreatePublishAndDetail(t *testing.T) {
	merchantToken := bgroupLoginAndGetToken(t, "13800000004", "test123456")
	id := bgroupCreateAndPublishActivity(t, merchantToken, 50)
	st, body := bgroupGetJSON(fmt.Sprintf("%s/activities/%d", bgroupBaseURL, id), "")
	if st != 200 {
		t.Fatalf("GET detail: %d %v", st, body)
	}
	if body["code"].(float64) != 0 {
		t.Fatalf("code: %v", body["code"])
	}
}

func TestBGroup_EnrollmentIdempotency(t *testing.T) {
	merchantToken := bgroupLoginAndGetToken(t, "13800000004", "test123456")
	activityID := bgroupCreateAndPublishActivity(t, merchantToken, 100)
	userToken := bgroupLoginAndGetToken(t, "13800000001", "test123456")

	st1, _ := bgroupPostJSON(bgroupBaseURL+"/enrollments", userToken, map[string]uint64{"activity_id": activityID})
	if st1 != 202 {
		t.Fatalf("第一次报名应 202, got %d", st1)
	}
	st2, _ := bgroupPostJSON(bgroupBaseURL+"/enrollments", userToken, map[string]uint64{"activity_id": activityID})
	if st2 != 409 {
		t.Errorf("重复报名应 409, got %d", st2)
	}
}

func TestBGroup_EnrollmentStockInsufficient(t *testing.T) {
	merchantToken := bgroupLoginAndGetToken(t, "13800000004", "test123456")
	activityID := bgroupCreateAndPublishActivity(t, merchantToken, 1)

	phone1 := fmt.Sprintf("178%08d", time.Now().UnixMilli()%100000000)
	bgroupRegisterUserDB(t, phone1, "B抢票1", "test123456")
	t1 := bgroupLoginAndGetToken(t, phone1, "test123456")
	bgroupPostJSON(bgroupBaseURL+"/enrollments", t1, map[string]uint64{"activity_id": activityID})

	phone2 := fmt.Sprintf("178%08d", time.Now().UnixMilli()%100000000+1)
	bgroupRegisterUserDB(t, phone2, "B抢票2", "test123456")
	t2 := bgroupLoginAndGetToken(t, phone2, "test123456")
	_, data := bgroupPostJSON(bgroupBaseURL+"/enrollments", t2, map[string]uint64{"activity_id": activityID})
	code, _ := data["code"].(float64)
	if int(code) != 1101 {
		t.Errorf("期望 code 1101，得到 %.0f", code)
	}
}

func TestBGroup_CreateActivityForbiddenForUser(t *testing.T) {
	userToken := bgroupLoginAndGetToken(t, "13800000001", "test123456")
	st, _ := bgroupPostJSON(bgroupBaseURL+"/activities", userToken, map[string]interface{}{
		"title": "x", "description": "x", "location": "x", "category": "CONCERT",
		"max_capacity": 100, "price": 10.0,
		"enroll_open_at":  time.Now().Add(1 * time.Hour).Format(time.RFC3339),
		"enroll_close_at": time.Now().Add(24 * time.Hour).Format(time.RFC3339),
		"activity_at":     time.Now().Add(48 * time.Hour).Format(time.RFC3339),
	})
	if st != 403 {
		t.Errorf("非 MERCHANT 创建活动应 403, got %d", st)
	}
}

func TestBGroup_OrderPayment(t *testing.T) {
	merchantToken := bgroupLoginAndGetToken(t, "13800000004", "test123456")
	activityID := bgroupCreateAndPublishActivity(t, merchantToken, 100)

	phone := fmt.Sprintf("198%08d", time.Now().UnixMilli()%100000000)
	bgroupRegisterUserDB(t, phone, "B支付", "test123456")
	userToken := bgroupLoginAndGetToken(t, phone, "test123456")
	bgroupPostJSON(bgroupBaseURL+"/enrollments", userToken, map[string]uint64{"activity_id": activityID})

	_, ordersData := bgroupGetJSON(bgroupBaseURL+"/orders?page=1&page_size=10", userToken)
	dataInner, _ := ordersData["data"].(map[string]interface{})
	orderList, _ := dataInner["list"].([]interface{})
	if len(orderList) == 0 {
		t.Fatal("报名后无订单")
	}
	firstOrder := orderList[0].(map[string]interface{})
	orderID := uint64(firstOrder["id"].(float64))
	if firstOrder["status"] != "PENDING" {
		t.Fatalf("应 PENDING, got %s", firstOrder["status"])
	}
	_, payData := bgroupPostJSON(fmt.Sprintf("%s/orders/%d/pay", bgroupBaseURL, orderID), userToken, nil)
	payInner, _ := payData["data"].(map[string]interface{})
	if payInner["status"] != "PAID" {
		t.Errorf("支付后期望 PAID, got %v", payData)
	}
}
func TestBGroup_ExpiredOrderScanStockReplenish(t *testing.T) {
	t.Skip("ScanExpired 由服务端后台 ticker(5m) 触发，当前无 HTTP/同步入口，黑盒无法稳定断言库存回补；需在暴露运维接口或缩短扫描间隔的测试环境验证")
}
