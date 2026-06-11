package worker

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/segmentio/kafka-go"
	"github.com/uaad/backend/internal/domain"
	"github.com/uaad/backend/internal/service"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

// ── stubs ───────────────────────────────────────────────────────────────────

type fakeStockEngine struct {
	mu             sync.Mutex
	rollbackCalled int
	rollbackErr    error
}

func (f *fakeStockEngine) WarmUp(ctx context.Context, activityID uint64, capacity int) error {
	return nil
}

func (f *fakeStockEngine) TryEnroll(ctx context.Context, activityID, userID uint64) (int64, error) {
	return 0, nil
}

func (f *fakeStockEngine) Rollback(ctx context.Context, activityID, userID uint64) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.rollbackCalled++
	return f.rollbackErr
}

func (f *fakeStockEngine) GetStock(ctx context.Context, activityID uint64) (int, error) {
	return 0, nil
}

func (f *fakeStockEngine) SetStock(ctx context.Context, activityID uint64, stock int) error {
	return nil
}

type capturedNotif struct {
	kind          string
	userID        uint64
	relatedID     uint64
	activityTitle string
}

type fakeNotifSvc struct {
	mu       sync.Mutex
	captured []capturedNotif
}

func (f *fakeNotifSvc) record(kind string, userID, relatedID uint64, title string) {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.captured = append(f.captured, capturedNotif{kind, userID, relatedID, title})
}

func (f *fakeNotifSvc) List(userID uint64, page, pageSize int) ([]domain.Notification, int64, error) {
	return nil, 0, nil
}
func (f *fakeNotifSvc) MarkRead(notificationID, userID uint64) error { return nil }
func (f *fakeNotifSvc) UnreadCount(userID uint64) (int64, error)     { return 0, nil }
func (f *fakeNotifSvc) NotifyEnrollSuccess(userID, enrollmentID uint64, activityTitle string) {
	f.record("ENROLL_SUCCESS", userID, enrollmentID, activityTitle)
}
func (f *fakeNotifSvc) NotifyEnrollFail(userID, enrollmentID uint64, activityTitle string) {
	f.record("ENROLL_FAIL", userID, enrollmentID, activityTitle)
}
func (f *fakeNotifSvc) NotifyOrderExpire(userID, orderID uint64, activityTitle string) {
	f.record("ORDER_EXPIRE", userID, orderID, activityTitle)
}
func (f *fakeNotifSvc) NotifyActivityReminder(userID, activityID uint64, activityTitle string) {
	f.record("ACTIVITY_REMINDER", userID, activityID, activityTitle)
}

type fakeActivityRepo struct {
	activity *domain.Activity
}

func (r *fakeActivityRepo) FindByID(id uint64) (*domain.Activity, error) {
	if r.activity == nil || r.activity.ID != id {
		return nil, gorm.ErrRecordNotFound
	}
	return r.activity, nil
}

// ── helpers ─────────────────────────────────────────────────────────────────

func setupTestDB(t *testing.T) *gorm.DB {
	t.Helper()
	dsn := fmt.Sprintf("file:worker_test_%d?mode=memory&cache=shared", time.Now().UnixNano())
	db, err := gorm.Open(sqlite.Open(dsn), &gorm.Config{})
	if err != nil {
		t.Fatalf("open sqlite: %v", err)
	}
	if err := db.AutoMigrate(&domain.Enrollment{}, &domain.Order{}, &domain.Activity{}); err != nil {
		t.Fatalf("automigrate: %v", err)
	}
	return db
}

func makeMessage(t *testing.T, em service.EnrollmentMessage) kafka.Message {
	t.Helper()
	payload, err := json.Marshal(em)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	return kafka.Message{Value: payload}
}

func newWorker(db *gorm.DB, stock *fakeStockEngine, notif *fakeNotifSvc, repo *fakeActivityRepo) *EnrollmentWorker {
	return &EnrollmentWorker{
		db:           db,
		stockEngine:  stock,
		notifSvc:     notif,
		activityRepo: repo,
	}
}

// ── tests ───────────────────────────────────────────────────────────────────

// TestHandleMessage_Success_PersistsAndNotifies verifies the happy path:
// QUEUING → SUCCESS, order created, activity.enroll_count incremented,
// ENROLL_SUCCESS notification dispatched with correct related_id.
func TestHandleMessage_Success_PersistsAndNotifies(t *testing.T) {
	db := setupTestDB(t)
	activity := &domain.Activity{
		ID: 7, Title: "五月天演唱会", MaxCapacity: 100, Status: "PUBLISHED",
		EnrollOpenAt:  time.Now().Add(-1 * time.Hour),
		EnrollCloseAt: time.Now().Add(1 * time.Hour),
		ActivityAt:    time.Now().Add(2 * time.Hour),
		CreatedBy:     1,
	}
	if err := db.Create(activity).Error; err != nil {
		t.Fatalf("seed activity: %v", err)
	}
	enrollment := &domain.Enrollment{UserID: 42, ActivityID: 7, Status: "QUEUING", EnrolledAt: time.Now()}
	if err := db.Create(enrollment).Error; err != nil {
		t.Fatalf("seed enrollment: %v", err)
	}

	stock := &fakeStockEngine{}
	notif := &fakeNotifSvc{}
	repo := &fakeActivityRepo{activity: activity}
	w := newWorker(db, stock, notif, repo)

	msg := makeMessage(t, service.EnrollmentMessage{
		EnrollmentID: enrollment.ID, UserID: 42, ActivityID: 7,
		Price: 99.0, Timestamp: time.Now().UnixMilli(),
	})
	w.handleMessage(context.Background(), msg)

	// Enrollment status flipped
	var got domain.Enrollment
	if err := db.First(&got, enrollment.ID).Error; err != nil {
		t.Fatalf("reload enrollment: %v", err)
	}
	if got.Status != "SUCCESS" {
		t.Errorf("status: want SUCCESS, got %s", got.Status)
	}

	// Order created
	var orderCount int64
	db.Model(&domain.Order{}).Where("enrollment_id = ?", enrollment.ID).Count(&orderCount)
	if orderCount != 1 {
		t.Errorf("expected 1 order, got %d", orderCount)
	}

	// enroll_count incremented
	var act domain.Activity
	db.First(&act, 7)
	if act.EnrollCount != 1 {
		t.Errorf("enroll_count: want 1, got %d", act.EnrollCount)
	}

	// Notification dispatched correctly
	if len(notif.captured) != 1 {
		t.Fatalf("expected 1 notification, got %d", len(notif.captured))
	}
	n := notif.captured[0]
	if n.kind != "ENROLL_SUCCESS" {
		t.Errorf("notif kind: want ENROLL_SUCCESS, got %s", n.kind)
	}
	if n.relatedID != enrollment.ID {
		t.Errorf("notif related_id: want %d, got %d", enrollment.ID, n.relatedID)
	}
	if n.activityTitle != "五月天演唱会" {
		t.Errorf("notif title: want '五月天演唱会', got %q", n.activityTitle)
	}
	if stock.rollbackCalled != 0 {
		t.Errorf("rollback should NOT be called on success, got %d", stock.rollbackCalled)
	}
}

// TestHandleMessage_TransactionFails_NotifyFailAndMarkFailed verifies that on
// MySQL transaction failure (we simulate via a corrupted activity_id):
//   - Redis rollback is called
//   - enrollment status flips QUEUING → FAILED
//   - ENROLL_FAIL notification is dispatched with the real enrollment_id (not 0)
func TestHandleMessage_TransactionFails_NotifyFailAndMarkFailed(t *testing.T) {
	db := setupTestDB(t)
	enrollment := &domain.Enrollment{UserID: 42, ActivityID: 999, Status: "QUEUING", EnrolledAt: time.Now()}
	if err := db.Create(enrollment).Error; err != nil {
		t.Fatalf("seed enrollment: %v", err)
	}
	// Activity 999 does NOT exist in DB → tx will fail at the enroll_count update
	// (not strictly — the WHERE can match 0 rows. Force failure by dropping the
	// activities table mid-flight.)
	if err := db.Migrator().DropTable(&domain.Activity{}); err != nil {
		t.Fatalf("drop activities: %v", err)
	}

	stock := &fakeStockEngine{}
	notif := &fakeNotifSvc{}
	repo := &fakeActivityRepo{} // empty — title lookup fails
	w := newWorker(db, stock, notif, repo)

	msg := makeMessage(t, service.EnrollmentMessage{
		EnrollmentID: enrollment.ID, UserID: 42, ActivityID: 999,
		Price: 50.0, Timestamp: time.Now().UnixMilli(),
	})
	w.handleMessage(context.Background(), msg)

	// 1) Enrollment status should now be FAILED
	var got domain.Enrollment
	if err := db.First(&got, enrollment.ID).Error; err != nil {
		t.Fatalf("reload enrollment: %v", err)
	}
	if got.Status != "FAILED" {
		t.Errorf("status: want FAILED, got %s", got.Status)
	}

	// 2) Redis rollback called
	if stock.rollbackCalled != 1 {
		t.Errorf("rollback should be called once, got %d", stock.rollbackCalled)
	}

	// 3) ENROLL_FAIL notification with real enrollment_id (not 0)
	if len(notif.captured) != 1 {
		t.Fatalf("expected 1 notification, got %d", len(notif.captured))
	}
	n := notif.captured[0]
	if n.kind != "ENROLL_FAIL" {
		t.Errorf("notif kind: want ENROLL_FAIL, got %s", n.kind)
	}
	if n.relatedID != enrollment.ID {
		t.Errorf("notif related_id: want %d (real enrollment), got %d", enrollment.ID, n.relatedID)
	}

	// 4) Title should be "活动 #999" — never "unknown" (SPRINT3 §三 task 1)
	if n.activityTitle == "unknown" {
		t.Errorf("notif title must NOT be literal 'unknown' (SPRINT3 violation)")
	}
	if !strings.Contains(n.activityTitle, "999") {
		t.Errorf("notif title fallback should reference activity id 999, got %q", n.activityTitle)
	}
}

// TestHandleMessage_AlreadyNotQueuing_Skips verifies idempotency: if the
// enrollment is already in a terminal state, the worker should skip silently.
func TestHandleMessage_AlreadyNotQueuing_Skips(t *testing.T) {
	db := setupTestDB(t)
	now := time.Now()
	finalized := now.Add(-1 * time.Minute)
	enrollment := &domain.Enrollment{
		UserID: 42, ActivityID: 7, Status: "SUCCESS", EnrolledAt: now, FinalizedAt: &finalized,
	}
	if err := db.Create(enrollment).Error; err != nil {
		t.Fatalf("seed enrollment: %v", err)
	}

	stock := &fakeStockEngine{}
	notif := &fakeNotifSvc{}
	w := newWorker(db, stock, notif, &fakeActivityRepo{})

	msg := makeMessage(t, service.EnrollmentMessage{
		EnrollmentID: enrollment.ID, UserID: 42, ActivityID: 7, Timestamp: now.UnixMilli(),
	})
	w.handleMessage(context.Background(), msg)

	// No notification should have been sent
	if len(notif.captured) != 0 {
		t.Errorf("expected 0 notifications for already-terminal enrollment, got %d: %+v",
			len(notif.captured), notif.captured)
	}
	// No order should have been created
	var orderCount int64
	db.Model(&domain.Order{}).Where("enrollment_id = ?", enrollment.ID).Count(&orderCount)
	if orderCount != 0 {
		t.Errorf("no order should be created for non-QUEUING enrollment, got %d", orderCount)
	}
	// No rollback either (it was already SUCCESS, not a failure)
	if stock.rollbackCalled != 0 {
		t.Errorf("rollback should NOT be called when skipping, got %d", stock.rollbackCalled)
	}
}

// TestHandleMessage_MalformedJSON_Drops verifies the worker silently drops
// unparseable Kafka payloads without panicking or sending notifications.
func TestHandleMessage_MalformedJSON_Drops(t *testing.T) {
	db := setupTestDB(t)
	stock := &fakeStockEngine{}
	notif := &fakeNotifSvc{}
	w := newWorker(db, stock, notif, &fakeActivityRepo{})

	bad := kafka.Message{Value: []byte(`{not valid json`)}
	w.handleMessage(context.Background(), bad)

	if len(notif.captured) != 0 {
		t.Errorf("expected 0 notifications for malformed payload, got %d", len(notif.captured))
	}
	if stock.rollbackCalled != 0 {
		t.Errorf("rollback should not be called for malformed payload, got %d", stock.rollbackCalled)
	}
}

// TestResolveWorkerActivityTitle_FallbackToID verifies the activity title
// resolver returns "活动 #<id>" when the activity cannot be loaded — never
// the literal "unknown" (SPRINT3 §三 task 1 hard requirement).
func TestResolveWorkerActivityTitle_FallbackToID(t *testing.T) {
	repo := &fakeActivityRepo{} // empty
	got := resolveWorkerActivityTitle(repo, 42)
	if got == "unknown" {
		t.Fatalf("MUST NOT return literal 'unknown' (SPRINT3 §三 task 1)")
	}
	if !strings.Contains(got, "42") {
		t.Errorf("fallback should reference activity id, got %q", got)
	}
}

// TestResolveWorkerActivityTitle_ReturnsRealTitle verifies the resolver
// returns the actual title when the activity exists.
func TestResolveWorkerActivityTitle_ReturnsRealTitle(t *testing.T) {
	repo := &fakeActivityRepo{activity: &domain.Activity{ID: 7, Title: "周杰伦演唱会"}}
	got := resolveWorkerActivityTitle(repo, 7)
	if got != "周杰伦演唱会" {
		t.Errorf("want '周杰伦演唱会', got %q", got)
	}
}

// TestResolveWorkerActivityTitle_EmptyTitleFallsBack verifies that an
// activity with empty title also triggers the id-based fallback (not "unknown").
func TestResolveWorkerActivityTitle_EmptyTitleFallsBack(t *testing.T) {
	repo := &fakeActivityRepo{activity: &domain.Activity{ID: 5, Title: ""}}
	got := resolveWorkerActivityTitle(repo, 5)
	if got == "unknown" || got == "" {
		t.Errorf("empty title must fall back to id format, got %q", got)
	}
	if !strings.Contains(got, "5") {
		t.Errorf("fallback should contain id 5, got %q", got)
	}
}

// silence unused import warnings if errors package is not used elsewhere
var _ = errors.New
