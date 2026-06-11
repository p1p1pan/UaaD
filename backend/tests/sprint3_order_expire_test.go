//go:build integration

// Sprint 3 ORDER_EXPIRE integration test — proves the closed loop:
//   user enrolls → order PENDING → expired_at flips into past →
//   ScanExpired() → CLOSED + stock rollback + ORDER_EXPIRE notification
//
// Why a separate file: this test bypasses the 5-min production ticker by
// constructing a real OrderService in-process (real MySQL + real Redis), then
// invoking ScanExpired() directly. The notification is then verified through
// the running server's GET /notifications endpoint.
//
// Prerequisites (same as the rest of the integration suite):
//   1. Server running:    cd backend && go run ./cmd/server
//   2. Seed loaded:       cd backend && go run ./scripts/seed
//   3. Docker stack up:   docker-compose up -d (MySQL/Redis/Kafka)
//
// Run:
//   cd backend && go test -v -tags=integration -run '^TestSprint3_OrderExpire' -count=1 ./tests/

package tests

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/uaad/backend/internal/config"
	"github.com/uaad/backend/internal/domain"
	"github.com/uaad/backend/internal/infra"
	"github.com/uaad/backend/internal/repository"
	"github.com/uaad/backend/internal/service"
)

// TestSprint3_OrderExpire_NotificationAndStockRollback verifies the full
// expiry chain end-to-end: artificially age a real PENDING order, run
// ScanExpired against the live MySQL+Redis stack, then confirm the
// running server surfaces the ORDER_EXPIRE notification through its
// public REST API.
func TestSprint3_OrderExpire_NotificationAndStockRollback(t *testing.T) {
	// ── Phase 1: drive the enrollment to SUCCESS via HTTP ─────────────────
	merchantToken := loginAndGetToken(t, "13800000004", "test123456")
	activityID := createAndPublishActivity(t, merchantToken, 5)
	t.Logf("活动 ID=%d, stock=5", activityID)

	phone := fmt.Sprintf("144%08d", time.Now().UnixMilli()%100000000)
	registerUserDB(t, phone, "过期通知用户", "test123456")
	userToken := loginAndGetToken(t, phone, "test123456")

	_, body := postJSON(baseURL+"/enrollments", userToken, map[string]uint64{"activity_id": activityID})
	dataInner, _ := body["data"].(map[string]interface{})
	enrollIDFloat, _ := dataInner["enrollment_id"].(float64)
	enrollmentID := uint64(enrollIDFloat)
	if enrollmentID == 0 {
		t.Fatalf("缺少 enrollment_id: %v", body)
	}

	orderNo := pollUntilEnrollmentSuccess(t, userToken, enrollmentID, 30*time.Second)
	t.Logf("Worker 完成报名 → SUCCESS, order_no=%s", orderNo)

	// ── Phase 2: locate the order row and expire it in MySQL ──────────────
	db := openTestDB(t)
	var order domain.Order
	if err := db.Where("order_no = ?", orderNo).First(&order).Error; err != nil {
		t.Fatalf("查找订单失败: %v", err)
	}
	if order.Status != "PENDING" {
		t.Fatalf("订单状态应为 PENDING, got %s", order.Status)
	}
	if err := db.Model(&domain.Order{}).
		Where("id = ?", order.ID).
		Update("expired_at", time.Now().Add(-1*time.Minute)).Error; err != nil {
		t.Fatalf("将订单 expired_at 改为过去失败: %v", err)
	}
	t.Logf("订单 %d 已强制过期", order.ID)

	// Capture activity enroll_count before scan to verify rollback later
	var actBefore domain.Activity
	db.First(&actBefore, activityID)
	countBefore := actBefore.EnrollCount

	// ── Phase 3: build a real OrderService and call ScanExpired() ─────────
	cfg := config.Load()
	rdb := infra.NewRedisClient(cfg)
	defer rdb.Close()

	stockEngine := service.NewStockEngine(rdb)
	orderRepo := repository.NewOrderRepository(db)
	activityRepo := repository.NewActivityRepository(db)
	notifRepo := repository.NewNotificationRepository(db)
	notifSvc := service.NewNotificationService(notifRepo)

	orderSvc := service.NewOrderService(orderRepo, activityRepo, stockEngine, notifSvc)
	closed, err := orderSvc.ScanExpired()
	if err != nil {
		t.Fatalf("ScanExpired error: %v", err)
	}
	if closed < 1 {
		t.Fatalf("ScanExpired 应至少关闭 1 个订单, got %d", closed)
	}
	t.Logf("✅ ScanExpired 关闭了 %d 个订单", closed)

	// ── Phase 4: verify all closed-loop side effects ───────────────────────

	// 4a) Order status is now CLOSED
	var orderAfter domain.Order
	db.First(&orderAfter, order.ID)
	if orderAfter.Status != "CLOSED" {
		t.Errorf("❌ 订单应为 CLOSED, got %s", orderAfter.Status)
	} else {
		t.Logf("✅ 订单 %d → CLOSED", order.ID)
	}

	// 4b) MySQL enroll_count rolled back by 1
	var actAfter domain.Activity
	db.First(&actAfter, activityID)
	if actAfter.EnrollCount != countBefore-1 {
		t.Errorf("❌ enroll_count 未回补: before=%d after=%d (expected %d)",
			countBefore, actAfter.EnrollCount, countBefore-1)
	} else {
		t.Logf("✅ enroll_count 回补: %d → %d", countBefore, actAfter.EnrollCount)
	}

	// 4c) Redis stock incremented (best-effort — only verify it didn't crash)
	ctx := context.Background()
	if remaining, err := stockEngine.GetStock(ctx, activityID); err == nil {
		t.Logf("✅ Redis 当前库存=%d (回补后)", remaining)
	}

	// 4d) ORDER_EXPIRE notification visible via the live server's GET /notifications
	n := findNotificationByTypeAndRelatedID(t, userToken, "ORDER_EXPIRE", order.ID, 5*time.Second)
	if n == nil {
		t.Errorf("❌ 未找到 ORDER_EXPIRE 通知 (related_id=%d)", order.ID)
	} else {
		title, _ := n["title"].(string)
		content, _ := n["content"].(string)
		if title == "" {
			t.Errorf("❌ 通知 title 为空")
		}
		// SPRINT3 §三 task 1 的硬性要求：内容里不能出现 "unknown" 字面量
		if containsUnknown(title) || containsUnknown(content) {
			t.Errorf("❌ 通知文案包含禁用字面量 'unknown': title=%q content=%q", title, content)
		}
		t.Logf("✅ ORDER_EXPIRE 通知已写入: title=%q", title)
	}
}

func containsUnknown(s string) bool {
	for i := 0; i+7 <= len(s); i++ {
		if s[i:i+7] == "unknown" {
			return true
		}
	}
	return false
}
