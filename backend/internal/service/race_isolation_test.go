package service

import (
	"context"
	"fmt"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/uaad/backend/internal/domain"
	"github.com/uaad/backend/internal/repository"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// ─────────────────────────────────────────────────────────────────────────────
// SPRINT3 §三 task 4 / task 7 hard race-isolation tests.
//
// DoD 4: 主动取消路径不会与 Pay() / ScanExpired() 产生重复回补
//
// All three methods (Cancel/Pay/ScanExpired) flip a PENDING order to a new
// terminal status (CLOSED/PAID). They share the same atomic CAS:
//
//     UPDATE orders SET status = ? WHERE id = ? AND status = 'PENDING'
//
// If the CAS row count is 0, the caller MUST treat it as a lost race and
// abort, returning an error rather than running the rollback path.
// ─────────────────────────────────────────────────────────────────────────────

type fakeStockEngineRace struct {
	rollbackCount atomic.Int32
}

func (f *fakeStockEngineRace) TryEnroll(ctx context.Context, activityID, userID uint64) (int64, error) {
	return 0, nil
}
func (f *fakeStockEngineRace) GetStock(ctx context.Context, activityID uint64) (int, error) {
	return 0, nil
}
func (f *fakeStockEngineRace) Rollback(ctx context.Context, activityID, userID uint64) error {
	f.rollbackCount.Add(1)
	return nil
}
func (f *fakeStockEngineRace) WarmUp(ctx context.Context, activityID uint64, stock int) error {
	return nil
}
func (f *fakeStockEngineRace) SetStock(ctx context.Context, activityID uint64, stock int) error {
	return nil
}

type noopNotifSvc struct{}

func (noopNotifSvc) List(userID uint64, page, pageSize int) ([]domain.Notification, int64, error) {
	return nil, 0, nil
}
func (noopNotifSvc) MarkRead(notificationID, userID uint64) error              { return nil }
func (noopNotifSvc) UnreadCount(userID uint64) (int64, error)                  { return 0, nil }
func (noopNotifSvc) NotifyEnrollSuccess(userID, enrollmentID uint64, t string) {}
func (noopNotifSvc) NotifyEnrollFail(userID, enrollmentID uint64, t string)    {}
func (noopNotifSvc) NotifyOrderExpire(userID, orderID uint64, t string)        {}
func (noopNotifSvc) NotifyActivityReminder(userID, aid uint64, t string)       {}

func setupRaceTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	// SQLite in-memory + shared cache + WAL (concurrent reads + serial writes,
	// matches MySQL semantics closer than rollback journal mode) +
	// busy_timeout (writes wait on lock instead of erroring).
	dsn := fmt.Sprintf("file:race_iso_%d?mode=memory&cache=shared&_journal_mode=WAL&_busy_timeout=5000", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	// Single connection: SQLite is single-writer, MaxOpenConns=1 prevents
	// goroutines from racing for the write lock and gives deterministic
	// CAS semantics matching production MySQL.
	if sqlDB, e := db.DB(); e == nil {
		sqlDB.SetMaxOpenConns(1)
	}
	if err := db.AutoMigrate(&domain.Activity{}, &domain.Enrollment{}, &domain.Order{}); err != nil {
		t.Fatalf("automigrate: %v", err)
	}
	return db
}

// TestRaceIsolation_CancelVsScanExpired_NoDoubleRollback
//
// Setup: PENDING order whose expired_at is already in the past so ScanExpired
// is eligible to close it. At the same time, the user calls Cancel.
//
// Expected: exactly ONE of {Cancel, ScanExpired} actually closes the order;
// the other observes status != PENDING and aborts WITHOUT calling
// stock rollback or IncrementStock a second time.
func TestRaceIsolation_CancelVsScanExpired_NoDoubleRollback(t *testing.T) {
	db := setupRaceTestDB(t)
	now := time.Now()

	activity := &domain.Activity{
		ID: 1, Title: "比赛", MaxCapacity: 10, EnrollCount: 1,
		EnrollOpenAt:  now.Add(-2 * time.Hour),
		EnrollCloseAt: now.Add(2 * time.Hour),
		ActivityAt:    now.Add(4 * time.Hour),
		Status:        "PUBLISHED", CreatedBy: 1,
	}
	db.Create(activity)
	enroll := &domain.Enrollment{ID: 1, UserID: 42, ActivityID: 1, Status: "SUCCESS", EnrolledAt: now}
	db.Create(enroll)
	order := &domain.Order{
		ID: 1, OrderNo: "ORD-RACE-1", EnrollmentID: 1, UserID: 42,
		ActivityID: 1, Amount: 99.0, Status: "PENDING",
		ExpiredAt: now.Add(-24 * time.Hour).UTC(), // expired far enough back to dodge SQLite TZ quirks
	}
	db.Create(order)

	stock := &fakeStockEngineRace{}
	notif := noopNotifSvc{}

	enrollRepo := repository.NewEnrollmentRepository(db)
	orderRepo := repository.NewOrderRepository(db)
	activityRepo := repository.NewActivityRepository(db)

	enrollSvc := NewEnrollmentService(db, stock, nil, enrollRepo, activityRepo, orderRepo)
	orderSvc := NewOrderService(orderRepo, activityRepo, stock, notif)

	// Fire both at the same time
	var wg sync.WaitGroup
	var cancelErr error
	var scanErr error
	var scanClosed int
	ready := make(chan struct{})

	wg.Add(2)
	go func() {
		defer wg.Done()
		<-ready
		cancelErr = enrollSvc.Cancel(context.Background(), 1, 42)
	}()
	go func() {
		defer wg.Done()
		<-ready
		scanClosed, scanErr = orderSvc.ScanExpired()
	}()
	close(ready)
	wg.Wait()

	t.Logf("cancelErr=%v scanErr=%v scanClosed=%d", cancelErr, scanErr, scanClosed)

	// Exactly one should have succeeded — the other observed status != PENDING
	cancelWon := cancelErr == nil
	scanWon := scanClosed == 1
	if cancelWon == scanWon {
		t.Errorf("❌ exactly one of {Cancel, ScanExpired} must close the order; got cancelWon=%v scanWon=%v",
			cancelWon, scanWon)
	}

	// Order is now closed (CLOSED) — verify state is terminal
	var got domain.Order
	db.First(&got, 1)
	if got.Status != "CLOSED" {
		t.Errorf("order status: want CLOSED, got %s", got.Status)
	}

	// Stock rollback called at most once (twice would be the duplicate-rollback bug)
	rollbacks := stock.rollbackCount.Load()
	if rollbacks > 1 {
		t.Errorf("❌ duplicate stock rollback! got %d calls (must be <=1)", rollbacks)
	}
	if rollbacks == 0 {
		t.Errorf("❌ stock rollback never called — closing path skipped compensation")
	}

	// enroll_count must be incremented (returned to pool) exactly once
	var actAfter domain.Activity
	db.First(&actAfter, 1)
	if actAfter.EnrollCount != 0 {
		t.Errorf("❌ enroll_count: want 0 (started at 1, rolled back once), got %d", actAfter.EnrollCount)
	}
}

// TestRaceIsolation_CancelVsPay verifies the user can't both Cancel and Pay
// the same order. One must win, the other must observe status != PENDING.
func TestRaceIsolation_CancelVsPay(t *testing.T) {
	db := setupRaceTestDB(t)
	now := time.Now()

	activity := &domain.Activity{
		ID: 2, Title: "比赛2", MaxCapacity: 10, EnrollCount: 1,
		EnrollOpenAt:  now.Add(-2 * time.Hour),
		EnrollCloseAt: now.Add(2 * time.Hour),
		ActivityAt:    now.Add(4 * time.Hour),
		Status:        "PUBLISHED", CreatedBy: 1,
	}
	db.Create(activity)
	db.Create(&domain.Enrollment{ID: 2, UserID: 7, ActivityID: 2, Status: "SUCCESS", EnrolledAt: now})
	db.Create(&domain.Order{
		ID: 2, OrderNo: "ORD-RACE-2", EnrollmentID: 2, UserID: 7,
		ActivityID: 2, Amount: 99.0, Status: "PENDING",
		ExpiredAt: now.Add(24 * time.Hour).UTC(), // not expired yet
	})

	stock := &fakeStockEngineRace{}
	notif := noopNotifSvc{}

	enrollRepo := repository.NewEnrollmentRepository(db)
	orderRepo := repository.NewOrderRepository(db)
	activityRepo := repository.NewActivityRepository(db)

	enrollSvc := NewEnrollmentService(db, stock, nil, enrollRepo, activityRepo, orderRepo)
	orderSvc := NewOrderService(orderRepo, activityRepo, stock, notif)

	var wg sync.WaitGroup
	var cancelErr, payErr error
	var payRes *PayResult
	ready := make(chan struct{})

	wg.Add(2)
	go func() {
		defer wg.Done()
		<-ready
		cancelErr = enrollSvc.Cancel(context.Background(), 2, 7)
	}()
	go func() {
		defer wg.Done()
		<-ready
		payRes, payErr = orderSvc.Pay(2, 7)
	}()
	close(ready)
	wg.Wait()

	cancelWon := cancelErr == nil
	payWon := payErr == nil && payRes != nil

	t.Logf("cancelWon=%v payWon=%v cancelErr=%v payErr=%v", cancelWon, payWon, cancelErr, payErr)

	if cancelWon == payWon {
		t.Errorf("❌ exactly one of {Cancel, Pay} must succeed; got cancelWon=%v payWon=%v",
			cancelWon, payWon)
	}

	// If Pay won, enroll_count must NOT be rolled back; if Cancel won, it must be.
	var actAfter domain.Activity
	db.First(&actAfter, 2)
	if payWon && actAfter.EnrollCount != 1 {
		t.Errorf("❌ Pay won but stock was rolled back: enroll_count=%d (expected 1)", actAfter.EnrollCount)
	}
	if cancelWon && actAfter.EnrollCount != 0 {
		t.Errorf("❌ Cancel won but stock not rolled back: enroll_count=%d (expected 0)", actAfter.EnrollCount)
	}

	// In either outcome, Redis rollback called at most once
	if rb := stock.rollbackCount.Load(); rb > 1 {
		t.Errorf("❌ Redis rollback called %d times (must be <= 1)", rb)
	}
}

// TestRaceIsolation_ScanExpiredTwice_Idempotent verifies that calling
// ScanExpired twice (sequentially OR concurrently) closes the order exactly
// once and rolls back stock exactly once. This is the key DoD 4 invariant —
// concurrent compensation MUST NOT double-rollback.
//
// We test sequentially (back-to-back invocations) to avoid SQLite's
// single-writer contention. The CAS atomicity comes from the database, not
// from goroutine ordering — so sequential calls catch the same bug a real
// race would (the second caller MUST observe status != PENDING and abort).
func TestRaceIsolation_ScanExpiredTwice_Idempotent(t *testing.T) {
	db := setupRaceTestDB(t)
	now := time.Now()

	activity := &domain.Activity{
		ID: 3, Title: "x", MaxCapacity: 10, EnrollCount: 1,
		EnrollOpenAt:  now.Add(-2 * time.Hour),
		EnrollCloseAt: now.Add(2 * time.Hour),
		ActivityAt:    now.Add(4 * time.Hour),
		Status:        "PUBLISHED", CreatedBy: 1,
	}
	db.Create(activity)
	db.Create(&domain.Order{
		ID: 3, OrderNo: "ORD-RACE-3", EnrollmentID: 99, UserID: 1,
		ActivityID: 3, Amount: 1.0, Status: "PENDING",
		ExpiredAt: now.Add(-24 * time.Hour).UTC(),
	})

	stock := &fakeStockEngineRace{}
	orderRepo := repository.NewOrderRepository(db)
	activityRepo := repository.NewActivityRepository(db)
	orderSvc := NewOrderService(orderRepo, activityRepo, stock, noopNotifSvc{})

	// First pass — the eligible order should close
	closed1, err := orderSvc.ScanExpired()
	if err != nil {
		t.Fatalf("first scan err: %v", err)
	}
	if closed1 != 1 {
		t.Fatalf("first scan: want 1 closed, got %d", closed1)
	}

	// Second pass IMMEDIATELY — must observe nothing to do (status != PENDING)
	closed2, err := orderSvc.ScanExpired()
	if err != nil {
		t.Fatalf("second scan err: %v", err)
	}
	if closed2 != 0 {
		t.Errorf("❌ second scan must be no-op (idempotency), got closed=%d", closed2)
	}

	// Critical DoD 4 invariant: stock rollback called exactly once across both calls
	if rb := stock.rollbackCount.Load(); rb != 1 {
		t.Errorf("❌ duplicate stock rollback (DoD 4 violation)! got %d calls (must be 1)", rb)
	}

	// MySQL enroll_count rolled back exactly once: 1 → 0
	var actAfter domain.Activity
	db.First(&actAfter, 3)
	if actAfter.EnrollCount != 0 {
		t.Errorf("❌ enroll_count: want 0, got %d", actAfter.EnrollCount)
	}

	// Final order state
	var got domain.Order
	db.First(&got, 3)
	if got.Status != "CLOSED" {
		t.Errorf("❌ order status: want CLOSED, got %s", got.Status)
	}
}
