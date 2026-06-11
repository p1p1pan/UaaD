package service

import (
	"context"
	"errors"

	"github.com/uaad/backend/internal/domain"
)

// StockReconcileResult summarizes one reconciliation run.
type StockReconcileResult struct {
	Checked  int `json:"checked"`
	Repaired int `json:"repaired"`
}

type stockReconcileActivityRepo interface {
	PublishedList(page, pageSize int) ([]domain.Activity, int64, error)
}

type stockReconcileEnrollmentRepo interface {
	ListByActivityID(activityID uint64, status string) ([]domain.Enrollment, error)
}

// StockReconciler compares Redis stock with DB-derived expected stock
// and heals drift by updating Redis stock key only.
type StockReconciler struct {
	activityRepo   stockReconcileActivityRepo
	enrollmentRepo stockReconcileEnrollmentRepo
	stockEngine    StockEngine
	pageSize       int
}

func NewStockReconciler(
	activityRepo stockReconcileActivityRepo,
	enrollmentRepo stockReconcileEnrollmentRepo,
	stockEngine StockEngine,
	pageSize int,
) *StockReconciler {
	if pageSize <= 0 {
		pageSize = 200
	}
	return &StockReconciler{
		activityRepo:   activityRepo,
		enrollmentRepo: enrollmentRepo,
		stockEngine:    stockEngine,
		pageSize:       pageSize,
	}
}

func (r *StockReconciler) Reconcile(ctx context.Context) (*StockReconcileResult, error) {
	res := &StockReconcileResult{}
	page := 1

	for {
		if err := ctx.Err(); err != nil {
			return res, err
		}

		activities, total, err := r.activityRepo.PublishedList(page, r.pageSize)
		if err != nil {
			return res, err
		}
		if len(activities) == 0 {
			return res, nil
		}

		for i := range activities {
			if err := ctx.Err(); err != nil {
				return res, err
			}

			act := activities[i]
			expected := act.MaxCapacity - int(act.EnrollCount)
			if expected < 0 {
				expected = 0
			}

			enrollments, err := r.enrollmentRepo.ListByActivityID(act.ID, "SUCCESS")
			if err == nil {
				expected = act.MaxCapacity - len(enrollments)
				if expected < 0 {
					expected = 0
				}
			}

			current, err := r.stockEngine.GetStock(ctx, act.ID)
			if err != nil || current != expected {
				if setErr := r.stockEngine.SetStock(ctx, act.ID, expected); setErr != nil {
					return res, errors.Join(err, setErr)
				}
				res.Repaired++
			}
			res.Checked++
		}

		if page*r.pageSize >= int(total) {
			return res, nil
		}
		page++
	}
}
