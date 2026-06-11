//go:build integration

// Sprint 3 closed-loop integration tests — verify the end-to-end flow that
// SPRINT3.md §三 (Backend 闭环组) demands:
//
//   - Enrollment notification chain: ENROLL_SUCCESS lands in /notifications
//   - enroll_count is incremented in MySQL after the Worker finalizes
//   - Order PENDING → PAID transitions and observable through /orders
//   - Cancellation flow for QUEUING and SUCCESS+PENDING states
//
// These tests rely on the live Kafka Worker pipeline, so allow a generous
// timeout (~30s) when polling for state transitions.
//
// Prerequisites:
//   1. Server running: cd backend && go run ./cmd/server
//   2. Seed data loaded: cd backend && go run ./scripts/seed
//
// Run:
//   cd backend && go test -v -tags=integration -run '^TestSprint3' -count=1 ./tests/

package tests

import (
	"fmt"
	"testing"
	"time"
)

// pollUntilEnrollmentSuccess polls GET /enrollments/:id/status until status
// becomes SUCCESS, then returns the order_no. Fails the test on timeout.
func pollUntilEnrollmentSuccess(t *testing.T, token string, enrollmentID uint64, timeout time.Duration) string {
	t.Helper()
	deadline := time.Now().Add(timeout)
	url := fmt.Sprintf("%s/enrollments/%d/status", baseURL, enrollmentID)

	for time.Now().Before(deadline) {
		_, body := getJSON(url, token)
		dataInner, _ := body["data"].(map[string]interface{})
		status, _ := dataInner["status"].(string)
		if status == "SUCCESS" {
			orderNo, _ := dataInner["order_no"].(string)
			return orderNo
		}
		if status == "FAILED" || status == "CANCELLED" {
			t.Fatalf("enrollment %d entered terminal state %s before SUCCESS", enrollmentID, status)
		}
		time.Sleep(500 * time.Millisecond)
	}
	t.Fatalf("enrollment %d did not reach SUCCESS within %s", enrollmentID, timeout)
	return ""
}

// findNotificationByTypeAndRelatedID scans the user's notifications page and
// returns the first matching record (or nil if not found within budget).
func findNotificationByTypeAndRelatedID(t *testing.T, token string, notifType string, relatedID uint64, timeout time.Duration) map[string]interface{} {
	t.Helper()
	deadline := time.Now().Add(timeout)

	for time.Now().Before(deadline) {
		_, body := getJSON(fmt.Sprintf("%s/notifications?page=1&page_size=50", baseURL), token)
		dataInner, _ := body["data"].(map[string]interface{})
		list, _ := dataInner["list"].([]interface{})
		for _, item := range list {
			n, _ := item.(map[string]interface{})
			gotType, _ := n["type"].(string)
			gotRel, _ := n["related_id"].(float64)
			if gotType == notifType && uint64(gotRel) == relatedID {
				return n
			}
		}
		time.Sleep(500 * time.Millisecond)
	}
	return nil
}

// fetchActivityEnrollCount reads the activity detail and returns the
// MySQL-tracked enroll_count.
func fetchActivityEnrollCount(t *testing.T, activityID uint64) int64 {
	t.Helper()
	_, body := getJSON(fmt.Sprintf("%s/activities/%d", baseURL, activityID), "")
	dataInner, _ := body["data"].(map[string]interface{})
	count, _ := dataInner["enroll_count"].(float64)
	return int64(count)
}

// =============================================================================
// Test A: 报名闭环 — POST /enrollments → Worker → ENROLL_SUCCESS 通知 + enroll_count 同步
// =============================================================================
func TestSprint3_EnrollmentClosedLoop_Notification_AndCount(t *testing.T) {
	merchantToken := loginAndGetToken(t, "13800000004", "test123456")
	activityID := createAndPublishActivity(t, merchantToken, 50)
	t.Logf("商户创建活动 ID=%d, stock=50", activityID)

	countBefore := fetchActivityEnrollCount(t, activityID)
	t.Logf("报名前 enroll_count = %d", countBefore)

	// Use a fresh user to avoid notification pollution from previous tests
	phone := fmt.Sprintf("155%08d", time.Now().UnixMilli()%100000000)
	registerUserDB(t, phone, "闭环测试用户", "test123456")
	userToken := loginAndGetToken(t, phone, "test123456")

	// Submit enrollment
	status, body := postJSON(baseURL+"/enrollments", userToken, map[string]uint64{"activity_id": activityID})
	if status != 202 {
		t.Fatalf("报名应返回 202, got %d: %v", status, body)
	}
	dataInner, _ := body["data"].(map[string]interface{})
	enrollIDFloat, ok := dataInner["enrollment_id"].(float64)
	if !ok || enrollIDFloat == 0 {
		t.Fatalf("响应缺少 enrollment_id: %v", body)
	}
	enrollmentID := uint64(enrollIDFloat)
	t.Logf("报名提交成功 (QUEUING), enrollment_id=%d", enrollmentID)

	// 1️⃣ Wait for Worker to flip status SUCCESS
	orderNo := pollUntilEnrollmentSuccess(t, userToken, enrollmentID, 30*time.Second)
	t.Logf("✅ Worker 处理完成: status=SUCCESS, order_no=%s", orderNo)

	// 2️⃣ Verify enroll_count incremented by 1
	countAfter := fetchActivityEnrollCount(t, activityID)
	if countAfter != countBefore+1 {
		t.Errorf("❌ enroll_count 未同步: before=%d, after=%d (期望 %d)", countBefore, countAfter, countBefore+1)
	} else {
		t.Logf("✅ enroll_count 同步: %d → %d", countBefore, countAfter)
	}

	// 3️⃣ Verify ENROLL_SUCCESS notification was created with related_id = enrollmentID
	n := findNotificationByTypeAndRelatedID(t, userToken, "ENROLL_SUCCESS", enrollmentID, 10*time.Second)
	if n == nil {
		t.Errorf("❌ 未找到 ENROLL_SUCCESS 通知 (related_id=%d)", enrollmentID)
	} else {
		t.Logf("✅ ENROLL_SUCCESS 通知已写入: title=%v, content=%v", n["title"], n["content"])
	}

	// 4️⃣ Verify user has at least one PENDING order matching this enrollment
	_, orderBody := getJSON(baseURL+"/orders?page=1&page_size=20", userToken)
	orderInner, _ := orderBody["data"].(map[string]interface{})
	orderList, _ := orderInner["list"].([]interface{})
	foundOrder := false
	for _, o := range orderList {
		om, _ := o.(map[string]interface{})
		if om["order_no"] == orderNo {
			foundOrder = true
			if om["status"] != "PENDING" {
				t.Errorf("❌ 订单状态应为 PENDING, got %v", om["status"])
			}
			break
		}
	}
	if !foundOrder {
		t.Errorf("❌ /orders 中未找到 order_no=%s", orderNo)
	} else {
		t.Logf("✅ 订单 %s 已存在且为 PENDING", orderNo)
	}
}

// =============================================================================
// Test B: 排队中取消 — POST /enrollments → POST /enrollments/:id/cancel
// =============================================================================
func TestSprint3_EnrollmentCancel_QueuingState(t *testing.T) {
	merchantToken := loginAndGetToken(t, "13800000004", "test123456")
	activityID := createAndPublishActivity(t, merchantToken, 100)
	t.Logf("活动 ID=%d", activityID)

	phone := fmt.Sprintf("166%08d", time.Now().UnixMilli()%100000000)
	registerUserDB(t, phone, "取消测试用户A", "test123456")
	userToken := loginAndGetToken(t, phone, "test123456")

	// Submit enrollment
	_, body := postJSON(baseURL+"/enrollments", userToken, map[string]uint64{"activity_id": activityID})
	dataInner, _ := body["data"].(map[string]interface{})
	enrollIDFloat, _ := dataInner["enrollment_id"].(float64)
	enrollmentID := uint64(enrollIDFloat)
	if enrollmentID == 0 {
		t.Fatalf("缺少 enrollment_id: %v", body)
	}
	t.Logf("报名提交 enrollment_id=%d", enrollmentID)

	// Try to cancel immediately (race against Worker — may already be SUCCESS)
	cancelURL := fmt.Sprintf("%s/enrollments/%d/cancel", baseURL, enrollmentID)
	cancelStatus, cancelBody := postJSON(cancelURL, userToken, nil)

	// Acceptance is broad: either 200 (cancelled cleanly) OR 400 if Worker already finalized.
	// Both are valid behaviors per Sprint 3 cancellation contract.
	switch cancelStatus {
	case 200:
		t.Log("✅ 取消成功 (QUEUING → CANCELLED 或 SUCCESS+PENDING → CANCELLED)")
		// Verify status endpoint reflects cancellation
		_, statusBody := getJSON(fmt.Sprintf("%s/enrollments/%d/status", baseURL, enrollmentID), userToken)
		statusInner, _ := statusBody["data"].(map[string]interface{})
		finalStatus, _ := statusInner["status"].(string)
		if finalStatus != "CANCELLED" {
			t.Errorf("❌ 取消后 status 应为 CANCELLED, got %s", finalStatus)
		} else {
			t.Logf("✅ status=CANCELLED")
		}
	case 400:
		t.Logf("⚠️ Worker 已完成且订单状态不允许取消 (这是合法竞态，跳过): %v", cancelBody)
	default:
		t.Errorf("❌ 取消返回意外状态 %d: %v", cancelStatus, cancelBody)
	}
}

// =============================================================================
// Test C: 已支付订单不可取消 — pay first, then cancel must fail
// =============================================================================
func TestSprint3_EnrollmentCancel_RejectedAfterPaid(t *testing.T) {
	merchantToken := loginAndGetToken(t, "13800000004", "test123456")
	activityID := createAndPublishActivity(t, merchantToken, 50)

	phone := fmt.Sprintf("177%08d", time.Now().UnixMilli()%100000000)
	registerUserDB(t, phone, "已支付不可取消", "test123456")
	userToken := loginAndGetToken(t, phone, "test123456")

	_, body := postJSON(baseURL+"/enrollments", userToken, map[string]uint64{"activity_id": activityID})
	dataInner, _ := body["data"].(map[string]interface{})
	enrollIDFloat, _ := dataInner["enrollment_id"].(float64)
	enrollmentID := uint64(enrollIDFloat)
	if enrollmentID == 0 {
		t.Fatalf("缺少 enrollment_id: %v", body)
	}

	// Wait for Worker to finalize and produce order
	orderNo := pollUntilEnrollmentSuccess(t, userToken, enrollmentID, 30*time.Second)
	t.Logf("✅ Worker 完成, order_no=%s", orderNo)

	// Find the order ID
	_, orderBody := getJSON(baseURL+"/orders?page=1&page_size=20", userToken)
	orderInner, _ := orderBody["data"].(map[string]interface{})
	orderList, _ := orderInner["list"].([]interface{})
	var orderID uint64
	for _, o := range orderList {
		om, _ := o.(map[string]interface{})
		if om["order_no"] == orderNo {
			orderID = uint64(om["id"].(float64))
			break
		}
	}
	if orderID == 0 {
		t.Fatalf("未找到刚创建的订单: order_no=%s", orderNo)
	}

	// Pay the order
	payStatus, payBody := postJSON(fmt.Sprintf("%s/orders/%d/pay", baseURL, orderID), userToken, nil)
	if payStatus != 200 {
		t.Fatalf("支付失败: status=%d, body=%v", payStatus, payBody)
	}
	t.Logf("✅ 支付成功: order=%d", orderID)

	// Try to cancel — should fail with 400
	cancelStatus, cancelBody := postJSON(fmt.Sprintf("%s/enrollments/%d/cancel", baseURL, enrollmentID), userToken, nil)
	if cancelStatus != 400 {
		t.Errorf("❌ 已支付订单取消应返回 400, got %d: %v", cancelStatus, cancelBody)
	} else {
		t.Logf("✅ 已支付订单不可取消 (400)")
	}
}

// =============================================================================
// Test D: 未读通知计数同步
// =============================================================================
func TestSprint3_UnreadNotificationCount_Increases(t *testing.T) {
	merchantToken := loginAndGetToken(t, "13800000004", "test123456")
	activityID := createAndPublishActivity(t, merchantToken, 50)

	phone := fmt.Sprintf("188%08d", time.Now().UnixMilli()%100000000)
	registerUserDB(t, phone, "未读计数用户", "test123456")
	userToken := loginAndGetToken(t, phone, "test123456")

	// Capture baseline unread count
	_, beforeBody := getJSON(baseURL+"/notifications/unread-count", userToken)
	beforeInner, _ := beforeBody["data"].(map[string]interface{})
	countBefore, _ := beforeInner["count"].(float64)
	t.Logf("初始未读数=%d", int64(countBefore))

	// Trigger ENROLL_SUCCESS by enrolling
	_, body := postJSON(baseURL+"/enrollments", userToken, map[string]uint64{"activity_id": activityID})
	dataInner, _ := body["data"].(map[string]interface{})
	enrollIDFloat, _ := dataInner["enrollment_id"].(float64)
	enrollmentID := uint64(enrollIDFloat)
	if enrollmentID == 0 {
		t.Fatalf("缺少 enrollment_id: %v", body)
	}

	pollUntilEnrollmentSuccess(t, userToken, enrollmentID, 30*time.Second)

	// Wait briefly for notification to be persisted
	time.Sleep(1 * time.Second)

	_, afterBody := getJSON(baseURL+"/notifications/unread-count", userToken)
	afterInner, _ := afterBody["data"].(map[string]interface{})
	countAfter, _ := afterInner["count"].(float64)
	t.Logf("Worker 完成后未读数=%d", int64(countAfter))

	if int64(countAfter) <= int64(countBefore) {
		t.Errorf("❌ 未读计数应增加: before=%d, after=%d", int64(countBefore), int64(countAfter))
	} else {
		t.Logf("✅ 未读计数从 %d 增至 %d", int64(countBefore), int64(countAfter))
	}
}
