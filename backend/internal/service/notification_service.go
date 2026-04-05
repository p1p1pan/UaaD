package service

import (
	"errors"
	"fmt"
	"log"

	"github.com/uaad/backend/internal/domain"
	"github.com/uaad/backend/internal/repository"
	"gorm.io/gorm"
)

var ErrNotificationNotFound = errors.New("notification not found")

// NotificationService handles in-app notifications for C-end users.
// NotifyEnrollSuccess is used by EnrollmentService after a successful transaction (same as EnrollSuccessNotifier).
// NotifyEnrollFail / NotifyOrderExpire / NotifyActivityReminder are best-effort writes for other modules to call when their flows run.
type NotificationService interface {
	List(userID uint64, page, pageSize int) ([]domain.Notification, int64, error)
	MarkRead(notificationID, userID uint64) error
	UnreadCount(userID uint64) (int64, error)
	NotifyEnrollSuccess(userID, enrollmentID uint64, activityTitle string)
	NotifyEnrollFail(userID, enrollmentID uint64, activityTitle string)
	NotifyOrderExpire(userID, orderID uint64, activityTitle string)
	NotifyActivityReminder(userID, activityID uint64, activityTitle string)
}

// EnrollSuccessNotifier is invoked after an enrollment transaction commits (optional dependency of EnrollmentService).
type EnrollSuccessNotifier interface {
	NotifyEnrollSuccess(userID, enrollmentID uint64, activityTitle string)
}

type notificationService struct {
	repo repository.NotificationRepository
}

// NewNotificationService creates a NotificationService.
func NewNotificationService(repo repository.NotificationRepository) NotificationService {
	return &notificationService{repo: repo}
}

// NotifyEnrollSuccess implements EnrollSuccessNotifier — creates ENROLL_SUCCESS notification (best-effort).
func (s *notificationService) NotifyEnrollSuccess(userID, enrollmentID uint64, activityTitle string) {
	title := "报名成功"
	content := fmt.Sprintf("您已成功报名活动「%s」，请尽快完成支付。", activityTitle)
	rel := enrollmentID
	n := &domain.Notification{
		UserID:    userID,
		Title:     title,
		Content:   content,
		Type:      "ENROLL_SUCCESS",
		RelatedID: &rel,
	}
	if err := s.repo.Create(n); err != nil {
		log.Printf("[notification] enroll success notify failed: %v", err)
	}
}

// NotifyEnrollFail writes ENROLL_FAIL; call from enrollment/ticket flow when a signup attempt fails (best-effort).
func (s *notificationService) NotifyEnrollFail(userID, enrollmentID uint64, activityTitle string) {
	title := "报名未成功"
	content := fmt.Sprintf("很遗憾，您在活动「%s」的报名未成功。如有疑问请查看活动说明或联系客服。", activityTitle)
	rel := enrollmentID
	n := &domain.Notification{
		UserID:    userID,
		Title:     title,
		Content:   content,
		Type:      "ENROLL_FAIL",
		RelatedID: &rel,
	}
	if err := s.repo.Create(n); err != nil {
		log.Printf("[notification] enroll fail notify failed: %v", err)
	}
}

// NotifyOrderExpire writes ORDER_EXPIRE; call after an unpaid order is closed (e.g. ScanExpired) (best-effort).
func (s *notificationService) NotifyOrderExpire(userID, orderID uint64, activityTitle string) {
	title := "订单已超时关闭"
	content := fmt.Sprintf("您有一笔针对活动「%s」的订单因超时未支付已关闭。如需参与请重新报名。", activityTitle)
	rel := orderID
	n := &domain.Notification{
		UserID:    userID,
		Title:     title,
		Content:   content,
		Type:      "ORDER_EXPIRE",
		RelatedID: &rel,
	}
	if err := s.repo.Create(n); err != nil {
		log.Printf("[notification] order expire notify failed: %v", err)
	}
}

// NotifyActivityReminder writes ACTIVITY_REMINDER; related_id is the activity id (best-effort).
func (s *notificationService) NotifyActivityReminder(userID, activityID uint64, activityTitle string) {
	title := "活动即将开始"
	content := fmt.Sprintf("您关注的活动「%s」即将开始，请提前安排行程。", activityTitle)
	rel := activityID
	n := &domain.Notification{
		UserID:    userID,
		Title:     title,
		Content:   content,
		Type:      "ACTIVITY_REMINDER",
		RelatedID: &rel,
	}
	if err := s.repo.Create(n); err != nil {
		log.Printf("[notification] activity reminder notify failed: %v", err)
	}
}

func (s *notificationService) List(userID uint64, page, pageSize int) ([]domain.Notification, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return s.repo.ListByUserID(userID, page, pageSize)
}

func (s *notificationService) MarkRead(notificationID, userID uint64) error {
	err := s.repo.MarkRead(notificationID, userID)
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return ErrNotificationNotFound
		}
		return err
	}
	return nil
}

func (s *notificationService) UnreadCount(userID uint64) (int64, error) {
	return s.repo.CountUnreadByUserID(userID)
}

var _ EnrollSuccessNotifier = (*notificationService)(nil)
