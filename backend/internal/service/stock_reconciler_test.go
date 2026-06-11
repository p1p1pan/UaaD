package service

import (
	"context"
	"errors"
	"testing"

	"github.com/uaad/backend/internal/domain"
)

type reconcileActivityRepoStub struct {
	pages map[int][]domain.Activity
	total int64
}

func (s *reconcileActivityRepoStub) PublishedList(page, pageSize int) ([]domain.Activity, int64, error) {
	return s.pages[page], s.total, nil
}

type reconcileEnrollmentRepoStub struct {
	successByActivity map[uint64]int
}

func (s *reconcileEnrollmentRepoStub) ListByActivityID(activityID uint64, status string) ([]domain.Enrollment, error) {
	n := s.successByActivity[activityID]
	out := make([]domain.Enrollment, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, domain.Enrollment{ID: uint64(i + 1), ActivityID: activityID, Status: status})
	}
	return out, nil
}

type reconcileStockEngineStub struct {
	stocks map[uint64]int
	sets   map[uint64]int
}

func (s *reconcileStockEngineStub) TryEnroll(ctx context.Context, activityID, userID uint64) (int64, error) {
	return 0, errors.New("not used")
}

func (s *reconcileStockEngineStub) GetStock(ctx context.Context, activityID uint64) (int, error) {
	v, ok := s.stocks[activityID]
	if !ok {
		return 0, errors.New("missing")
	}
	return v, nil
}

func (s *reconcileStockEngineStub) Rollback(ctx context.Context, activityID, userID uint64) error {
	return nil
}

func (s *reconcileStockEngineStub) WarmUp(ctx context.Context, activityID uint64, stock int) error {
	s.stocks[activityID] = stock
	s.sets[activityID] = 0
	return nil
}

func (s *reconcileStockEngineStub) SetStock(ctx context.Context, activityID uint64, stock int) error {
	s.stocks[activityID] = stock
	return nil
}

func TestStockReconciler_ReconcileRepairsDrift(t *testing.T) {
	activityRepo := &reconcileActivityRepoStub{
		pages: map[int][]domain.Activity{
			1: {
				{ID: 1, MaxCapacity: 10, EnrollCount: 2, Status: "PUBLISHED"},
				{ID: 2, MaxCapacity: 5, EnrollCount: 1, Status: "PUBLISHED"},
			},
		},
		total: 2,
	}
	enrollmentRepo := &reconcileEnrollmentRepoStub{
		successByActivity: map[uint64]int{
			1: 3, // expected stock: 7
			2: 1, // expected stock: 4
		},
	}
	stockEngine := &reconcileStockEngineStub{
		stocks: map[uint64]int{
			1: 9,
		},
		sets: map[uint64]int{
			1: 10,
			2: 99,
		},
	}

	r := NewStockReconciler(activityRepo, enrollmentRepo, stockEngine, 100)
	result, err := r.Reconcile(context.Background())
	if err != nil {
		t.Fatalf("reconcile error: %v", err)
	}
	if result.Checked != 2 {
		t.Fatalf("expected checked=2, got %d", result.Checked)
	}
	if result.Repaired != 2 {
		t.Fatalf("expected repaired=2, got %d", result.Repaired)
	}
	if stockEngine.stocks[1] != 7 {
		t.Fatalf("expected activity 1 stock=7, got %d", stockEngine.stocks[1])
	}
	if stockEngine.stocks[2] != 4 {
		t.Fatalf("expected activity 2 stock=4, got %d", stockEngine.stocks[2])
	}
	if stockEngine.sets[1] != 10 || stockEngine.sets[2] != 99 {
		t.Fatalf("enrolled set metadata should not be mutated: %+v", stockEngine.sets)
	}
}

func TestStockReconciler_ReconcileNoDrift(t *testing.T) {
	activityRepo := &reconcileActivityRepoStub{
		pages: map[int][]domain.Activity{
			1: {
				{ID: 10, MaxCapacity: 20, EnrollCount: 5, Status: "PUBLISHED"},
			},
		},
		total: 1,
	}
	enrollmentRepo := &reconcileEnrollmentRepoStub{
		successByActivity: map[uint64]int{
			10: 5,
		},
	}
	stockEngine := &reconcileStockEngineStub{
		stocks: map[uint64]int{
			10: 15,
		},
		sets: map[uint64]int{10: 7},
	}

	r := NewStockReconciler(activityRepo, enrollmentRepo, stockEngine, 100)
	result, err := r.Reconcile(context.Background())
	if err != nil {
		t.Fatalf("reconcile error: %v", err)
	}
	if result.Checked != 1 {
		t.Fatalf("expected checked=1, got %d", result.Checked)
	}
	if result.Repaired != 0 {
		t.Fatalf("expected repaired=0, got %d", result.Repaired)
	}
}
