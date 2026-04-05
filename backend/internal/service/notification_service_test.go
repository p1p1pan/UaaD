package service

import (
	"errors"
	"testing"

	"github.com/uaad/backend/internal/domain"
	"gorm.io/gorm"
)

type stubNotifRepo struct {
	list         []domain.Notification
	total        int64
	lastPage     int
	lastPageSize int
}

func (s *stubNotifRepo) Create(n *domain.Notification) error { return nil }

func (s *stubNotifRepo) ListByUserID(userID uint64, page, pageSize int) ([]domain.Notification, int64, error) {
	s.lastPage = page
	s.lastPageSize = pageSize
	return s.list, s.total, nil
}

func (s *stubNotifRepo) FindByIDAndUserID(id, userID uint64) (*domain.Notification, error) {
	return nil, nil
}

func (s *stubNotifRepo) MarkRead(id, userID uint64) error {
	return gorm.ErrRecordNotFound
}

func (s *stubNotifRepo) CountUnreadByUserID(userID uint64) (int64, error) {
	return 3, nil
}

type captureNotifRepo struct {
	stubNotifRepo
	created []*domain.Notification
}

func (c *captureNotifRepo) Create(n *domain.Notification) error {
	c.created = append(c.created, n)
	return nil
}

func TestNotificationService_List_NormalizesPagination(t *testing.T) {
	repo := &stubNotifRepo{}
	svc := NewNotificationService(repo)
	_, _, err := svc.List(1, 0, 500)
	if err != nil {
		t.Fatal(err)
	}
	if repo.lastPage != 1 || repo.lastPageSize != 20 {
		t.Fatalf("want page=1 pageSize=20, got %d %d", repo.lastPage, repo.lastPageSize)
	}
}

func TestNotificationService_MarkRead_NotFound(t *testing.T) {
	svc := NewNotificationService(&stubNotifRepo{})
	err := svc.MarkRead(1, 1)
	if !errors.Is(err, ErrNotificationNotFound) {
		t.Fatalf("want ErrNotificationNotFound, got %v", err)
	}
}

func TestNotificationService_UnreadCount(t *testing.T) {
	svc := NewNotificationService(&stubNotifRepo{})
	n, err := svc.UnreadCount(1)
	if err != nil || n != 3 {
		t.Fatalf("want 3, got %d err=%v", n, err)
	}
}

func TestNotificationService_NotifyEnrollSuccess(t *testing.T) {
	repo := &captureNotifRepo{}
	svc := NewNotificationService(repo)
	svc.NotifyEnrollSuccess(7, 100, "测试活动")
	if len(repo.created) != 1 {
		t.Fatalf("want 1 notification, got %d", len(repo.created))
	}
	n := repo.created[0]
	if n.UserID != 7 || n.Type != "ENROLL_SUCCESS" || *n.RelatedID != 100 {
		t.Fatalf("unexpected notification: %+v", n)
	}
	if n.Title == "" || n.Content == "" {
		t.Fatal("want non-empty title and content")
	}
}

func TestNotificationService_NotifyEnrollFail(t *testing.T) {
	repo := &captureNotifRepo{}
	svc := NewNotificationService(repo)
	svc.NotifyEnrollFail(7, 101, "失败活动")
	if len(repo.created) != 1 || repo.created[0].Type != "ENROLL_FAIL" || *repo.created[0].RelatedID != 101 {
		t.Fatalf("got %+v", repo.created)
	}
}

func TestNotificationService_NotifyOrderExpire(t *testing.T) {
	repo := &captureNotifRepo{}
	svc := NewNotificationService(repo)
	svc.NotifyOrderExpire(8, 200, "订单活动")
	if len(repo.created) != 1 || repo.created[0].Type != "ORDER_EXPIRE" || *repo.created[0].RelatedID != 200 {
		t.Fatalf("got %+v", repo.created)
	}
}

func TestNotificationService_NotifyActivityReminder(t *testing.T) {
	repo := &captureNotifRepo{}
	svc := NewNotificationService(repo)
	svc.NotifyActivityReminder(9, 300, "提醒活动")
	if len(repo.created) != 1 || repo.created[0].Type != "ACTIVITY_REMINDER" || *repo.created[0].RelatedID != 300 {
		t.Fatalf("got %+v", repo.created)
	}
}
