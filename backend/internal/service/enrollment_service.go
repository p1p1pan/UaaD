package service

import (
	"errors"
	"fmt"
	"sync/atomic"
	"time"

	"github.com/uaad/backend/internal/domain"
	"github.com/uaad/backend/internal/repository"
	"gorm.io/gorm"
)

var (
	ErrAlreadyEnrolled   = errors.New("already enrolled for this activity")
	ErrStockInsufficient = errors.New("stock insufficient")
	ErrEnrollmentClosed  = errors.New("enrollment window is closed")
	ErrEnrollNotFound    = errors.New("enrollment not found")
)

// orderSeq is used to generate unique order numbers within this process.
var orderSeq atomic.Int64

// GenerateOrderNo generates an order number in the format ORD{YYYYMMDD}{8-digit seq}.
func GenerateOrderNo() string {
	seq := orderSeq.Add(1)
	return fmt.Sprintf("ORD%s%08d", time.Now().Format("20060102"), seq)
}

// EnrollResult holds the data returned after a successful enrollment.
type EnrollResult struct {
	EnrollmentID uint64 `json:"enrollment_id"`
	Status       string `json:"status"`
	OrderNo      string `json:"order_no"`
}

// EnrollmentService defines business logic for enrollments.
type EnrollmentService interface {
	Create(userID, activityID uint64) (*EnrollResult, error)
	GetStatus(enrollmentID, userID uint64) (*domain.Enrollment, *domain.Activity, *domain.Order, error)
	ListByUser(userID uint64, page, pageSize int) ([]domain.Enrollment, int64, error)
}

type enrollmentService struct {
	db           *gorm.DB
	enrollRepo   repository.EnrollmentRepository
	activityRepo repository.ActivityRepository
	orderRepo    repository.OrderRepository
}

// NewEnrollmentService creates a new EnrollmentService.
func NewEnrollmentService(
	db *gorm.DB,
	enrollRepo repository.EnrollmentRepository,
	activityRepo repository.ActivityRepository,
	orderRepo repository.OrderRepository,
) EnrollmentService {
	return &enrollmentService{
		db:           db,
		enrollRepo:   enrollRepo,
		activityRepo: activityRepo,
		orderRepo:    orderRepo,
	}
}

func (s *enrollmentService) Create(userID, activityID uint64) (*EnrollResult, error) {
	// 1. Idempotency check
	existing, _ := s.enrollRepo.FindByUserAndActivity(userID, activityID)
	if existing != nil {
		return nil, ErrAlreadyEnrolled
	}

	// 2. Check activity exists, is PUBLISHED, and enrollment window is open
	activity, err := s.activityRepo.FindByID(activityID)
	if err != nil {
		return nil, ErrActivityNotFound
	}
	if activity.Status != "PUBLISHED" && activity.Status != "SELLING_OUT" {
		return nil, ErrEnrollmentClosed
	}
	now := time.Now()
	if now.Before(activity.EnrollOpenAt) || now.After(activity.EnrollCloseAt) {
		return nil, ErrEnrollmentClosed
	}

	// 3. Transaction: deduct stock + create enrollment + create order
	var enrollment domain.Enrollment
	var order domain.Order

	err = s.db.Transaction(func(tx *gorm.DB) error {
		// Optimistic lock stock deduction
		result := tx.Model(&domain.Activity{}).
			Where("id = ? AND enroll_count < max_capacity AND status IN ?", activityID, []string{"PUBLISHED", "SELLING_OUT"}).
			Update("enroll_count", gorm.Expr("enroll_count + 1"))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrStockInsufficient
		}

		// Create enrollment (dev phase: direct SUCCESS, QUEUING reserved)
		enrollment = domain.Enrollment{
			UserID:     userID,
			ActivityID: activityID,
			Status:     "SUCCESS",
			EnrolledAt: now,
		}
		finalizedAt := now
		enrollment.FinalizedAt = &finalizedAt
		if err := tx.Create(&enrollment).Error; err != nil {
			return err
		}

		// Create order
		order = domain.Order{
			OrderNo:      GenerateOrderNo(),
			EnrollmentID: enrollment.ID,
			UserID:       userID,
			ActivityID:   activityID,
			Amount:       activity.Price,
			Status:       "PENDING",
			ExpiredAt:    now.Add(15 * time.Minute),
		}
		if err := tx.Create(&order).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		return nil, err
	}

	return &EnrollResult{
		EnrollmentID: enrollment.ID,
		Status:       enrollment.Status,
		OrderNo:      order.OrderNo,
	}, nil
}

func (s *enrollmentService) GetStatus(enrollmentID, userID uint64) (*domain.Enrollment, *domain.Activity, *domain.Order, error) {
	enrollment, err := s.enrollRepo.FindByID(enrollmentID)
	if err != nil {
		return nil, nil, nil, ErrEnrollNotFound
	}
	if enrollment.UserID != userID {
		return nil, nil, nil, ErrEnrollNotFound
	}

	activity, _ := s.activityRepo.FindByID(enrollment.ActivityID)

	// Find the associated order
	var order *domain.Order
	orders, _, _ := s.orderRepo.FindByUserID(userID, 1, 100)
	for i := range orders {
		if orders[i].EnrollmentID == enrollmentID {
			order = &orders[i]
			break
		}
	}

	return enrollment, activity, order, nil
}

func (s *enrollmentService) ListByUser(userID uint64, page, pageSize int) ([]domain.Enrollment, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return s.enrollRepo.ListByUserID(userID, page, pageSize)
}
