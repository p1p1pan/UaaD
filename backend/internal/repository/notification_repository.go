package repository

import (
	"github.com/uaad/backend/internal/domain"
	"gorm.io/gorm"
)

// NotificationRepository defines data access for notifications.
type NotificationRepository interface {
	Create(n *domain.Notification) error
	ListByUserID(userID uint64, page, pageSize int) ([]domain.Notification, int64, error)
	FindByIDAndUserID(id, userID uint64) (*domain.Notification, error)
	MarkRead(id, userID uint64) error
	CountUnreadByUserID(userID uint64) (int64, error)
}

type notificationRepository struct {
	db *gorm.DB
}

// NewNotificationRepository creates a notificationRepository.
func NewNotificationRepository(db *gorm.DB) NotificationRepository {
	return &notificationRepository{db: db}
}

func (r *notificationRepository) Create(n *domain.Notification) error {
	return r.db.Create(n).Error
}

func (r *notificationRepository) ListByUserID(userID uint64, page, pageSize int) ([]domain.Notification, int64, error) {
	var total int64
	if err := r.db.Model(&domain.Notification{}).Where("user_id = ?", userID).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	var list []domain.Notification
	offset := (page - 1) * pageSize
	if err := r.db.Where("user_id = ?", userID).
		Order("created_at DESC").
		Offset(offset).
		Limit(pageSize).
		Find(&list).Error; err != nil {
		return nil, 0, err
	}
	return list, total, nil
}

func (r *notificationRepository) FindByIDAndUserID(id, userID uint64) (*domain.Notification, error) {
	var n domain.Notification
	if err := r.db.Where("id = ? AND user_id = ?", id, userID).First(&n).Error; err != nil {
		return nil, err
	}
	return &n, nil
}

func (r *notificationRepository) MarkRead(id, userID uint64) error {
	res := r.db.Model(&domain.Notification{}).
		Where("id = ? AND user_id = ?", id, userID).
		Update("is_read", true)
	if res.Error != nil {
		return res.Error
	}
	if res.RowsAffected == 0 {
		return gorm.ErrRecordNotFound
	}
	return nil
}

func (r *notificationRepository) CountUnreadByUserID(userID uint64) (int64, error) {
	var n int64
	err := r.db.Model(&domain.Notification{}).
		Where("user_id = ? AND is_read = ?", userID, false).
		Count(&n).Error
	return n, err
}
