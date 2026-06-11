package service

import (
	"context"
	"errors"
	"fmt"
	"log"
	"time"

	"github.com/uaad/backend/internal/domain"
	"github.com/uaad/backend/internal/repository"
)

// resolveActivityTitle returns the activity's title, falling back to a
// human-readable "活动 #<id>" when the activity row cannot be loaded — never
// the literal string "unknown" (forbidden by SPRINT3 §三 task 1).
func resolveActivityTitle(repo repository.ActivityRepository, activityID uint64) string {
	if act, err := repo.FindByID(activityID); err == nil && act.Title != "" {
		return act.Title
	}
	log.Printf("[notification] activity title lookup failed, using id fallback: activity=%d", activityID)
	return fmt.Sprintf("活动 #%d", activityID)
}

var (
	ErrOrderNotFound   = errors.New("order not found")
	ErrOrderNotPending = errors.New("order is not in PENDING status")
	ErrOrderExpired    = errors.New("order has expired")
)

// PayResult holds the data returned after a successful payment.
type PayResult struct {
	OrderNo string    `json:"order_no"`
	Status  string    `json:"status"`
	PaidAt  time.Time `json:"paid_at"`
}

// OrderService defines business logic for orders.
type OrderService interface {
	ListByUser(userID uint64, page, pageSize int) ([]domain.Order, int64, error)
	Detail(orderID, userID uint64) (*domain.Order, error)
	Pay(orderID, userID uint64) (*PayResult, error)
	ScanExpired() (int, error)
}

type orderService struct {
	orderRepo    repository.OrderRepository
	activityRepo repository.ActivityRepository
	stockEngine  StockEngine
	notifSvc     NotificationService
}

// NewOrderService creates a new OrderService.
func NewOrderService(
	orderRepo repository.OrderRepository,
	activityRepo repository.ActivityRepository,
	stockEngine StockEngine,
	notifSvc NotificationService,
) OrderService {
	return &orderService{
		orderRepo:    orderRepo,
		activityRepo: activityRepo,
		stockEngine:  stockEngine,
		notifSvc:     notifSvc,
	}
}

func (s *orderService) ListByUser(userID uint64, page, pageSize int) ([]domain.Order, int64, error) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}
	return s.orderRepo.FindByUserID(userID, page, pageSize)
}

func (s *orderService) Detail(orderID, userID uint64) (*domain.Order, error) {
	order, err := s.orderRepo.FindByID(orderID)
	if err != nil {
		return nil, ErrOrderNotFound
	}
	if order.UserID != userID {
		return nil, ErrOrderNotFound
	}
	return order, nil
}

func (s *orderService) Pay(orderID, userID uint64) (*PayResult, error) {
	order, err := s.orderRepo.FindByID(orderID)
	if err != nil {
		return nil, ErrOrderNotFound
	}
	if order.UserID != userID {
		return nil, ErrOrderNotFound
	}
	if order.Status != "PENDING" {
		return nil, ErrOrderNotPending
	}
	if time.Now().After(order.ExpiredAt) {
		return nil, ErrOrderExpired
	}

	updated, err := s.orderRepo.UpdateStatusFromPending(order.ID, "PAID")
	if err != nil {
		return nil, err
	}
	if !updated {
		return nil, ErrOrderNotPending
	}

	return &PayResult{
		OrderNo: order.OrderNo,
		Status:  "PAID",
		PaidAt:  time.Now(),
	}, nil
}

// ScanExpired finds expired PENDING orders, closes them, and rolls back stock
// in both MySQL (audit counter) and Redis (live stock + enrolled set).
func (s *orderService) ScanExpired() (int, error) {
	orders, err := s.orderRepo.ListExpired()
	if err != nil {
		return 0, err
	}

	ctx := context.Background()
	closed := 0
	for _, order := range orders {
		updated, err := s.orderRepo.UpdateStatusFromPending(order.ID, "CLOSED")
		if err != nil {
			continue
		}
		if !updated {
			continue
		}
		_ = s.activityRepo.IncrementStock(order.ActivityID)
		if err := s.stockEngine.Rollback(ctx, order.ActivityID, order.UserID); err != nil {
			log.Printf("[OrderExpiry] Redis rollback failed for order=%d activity=%d user=%d: %v",
				order.ID, order.ActivityID, order.UserID, err)
		}
		if s.notifSvc != nil {
			activityTitle := resolveActivityTitle(s.activityRepo, order.ActivityID)
			s.notifSvc.NotifyOrderExpire(order.UserID, order.ID, activityTitle)
		}
		closed++
	}
	return closed, nil
}
