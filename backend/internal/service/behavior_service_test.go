package service

import (
	"testing"

	"github.com/uaad/backend/internal/domain"
)

type stubBehaviorRepo struct {
	created []*domain.UserBehavior
	batch   [][]*domain.UserBehavior
}

func (s *stubBehaviorRepo) Create(b *domain.UserBehavior) error {
	s.created = append(s.created, b)
	return nil
}

func (s *stubBehaviorRepo) BatchCreate(behaviors []*domain.UserBehavior) error {
	s.batch = append(s.batch, behaviors)
	return nil
}

func (s *stubBehaviorRepo) ListByUserID(userID uint64, limit int) ([]domain.UserBehavior, error) {
	return nil, nil
}

func (s *stubBehaviorRepo) CountByActivityAndType(activityID uint64, behaviorType string) (int64, error) {
	return 0, nil
}

func TestBehaviorService_Submit_InvalidType(t *testing.T) {
	svc := NewBehaviorService(&stubBehaviorRepo{})
	err := svc.Submit(1, false, BehaviorSubmit{ActivityID: 1, BehaviorType: "INVALID"})
	if err != ErrInvalidBehaviorType {
		t.Fatalf("want ErrInvalidBehaviorType, got %v", err)
	}
}

func TestBehaviorService_Submit_ZeroActivityID(t *testing.T) {
	svc := NewBehaviorService(&stubBehaviorRepo{})
	err := svc.Submit(1, false, BehaviorSubmit{ActivityID: 0, BehaviorType: "VIEW"})
	if err == nil {
		t.Fatal("want error for activity_id=0")
	}
}

func TestBehaviorService_Submit_SyncWrites(t *testing.T) {
	repo := &stubBehaviorRepo{}
	svc := NewBehaviorService(repo)
	if err := svc.Submit(1, false, BehaviorSubmit{ActivityID: 5, BehaviorType: "VIEW"}); err != nil {
		t.Fatal(err)
	}
	if len(repo.created) != 1 || repo.created[0].ActivityID != 5 {
		t.Fatalf("want one behavior for activity 5, got %+v", repo.created)
	}
}

func TestBehaviorService_SubmitBatch_TooBig(t *testing.T) {
	svc := NewBehaviorService(&stubBehaviorRepo{})
	items := make([]BehaviorSubmit, behaviorBatchMax+1)
	for i := range items {
		items[i] = BehaviorSubmit{ActivityID: 1, BehaviorType: "VIEW"}
	}
	err := svc.SubmitBatch(1, false, items)
	if err != ErrBehaviorBatchTooBig {
		t.Fatalf("want ErrBehaviorBatchTooBig, got %v", err)
	}
}

func TestBehaviorService_SubmitBatch_Sync(t *testing.T) {
	repo := &stubBehaviorRepo{}
	svc := NewBehaviorService(repo)
	err := svc.SubmitBatch(9, false, []BehaviorSubmit{
		{ActivityID: 1, BehaviorType: "VIEW"},
		{ActivityID: 2, BehaviorType: "COLLECT", Detail: map[string]interface{}{"source": "x"}},
	})
	if err != nil {
		t.Fatal(err)
	}
	if len(repo.batch) != 1 || len(repo.batch[0]) != 2 {
		t.Fatalf("batch not recorded: %+v", repo.batch)
	}
	if repo.batch[0][1].Detail == nil {
		t.Fatal("expected detail json")
	}
}

func TestBehaviorService_SubmitBatch_Empty(t *testing.T) {
	svc := NewBehaviorService(&stubBehaviorRepo{})
	err := svc.SubmitBatch(1, false, nil)
	if err != ErrBehaviorBatchEmpty {
		t.Fatalf("want ErrBehaviorBatchEmpty, got %v", err)
	}
}
