package service

import (
	"errors"
	"time"

	"github.com/uaad/backend/internal/domain"
	"github.com/uaad/backend/internal/repository"
)

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
}

// NewOrderService creates a new OrderService.
func NewOrderService(
	orderRepo repository.OrderRepository,
	activityRepo repository.ActivityRepository,
) OrderService {
	return &orderService{
		orderRepo:    orderRepo,
		activityRepo: activityRepo,
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

	if err := s.orderRepo.UpdateStatus(order.ID, "PAID"); err != nil {
		return nil, err
	}

	return &PayResult{
		OrderNo: order.OrderNo,
		Status:  "PAID",
		PaidAt:  time.Now(),
	}, nil
}

// ScanExpired finds expired PENDING orders, closes them, and rolls back stock.
func (s *orderService) ScanExpired() (int, error) {
	orders, err := s.orderRepo.ListExpired()
	if err != nil {
		return 0, err
	}

	closed := 0
	for _, order := range orders {
		if err := s.orderRepo.UpdateStatus(order.ID, "CLOSED"); err != nil {
			continue
		}
		// Rollback stock
		_ = s.activityRepo.IncrementStock(order.ActivityID)
		closed++
	}
	return closed, nil
}
