package worker

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"time"

	"github.com/segmentio/kafka-go"
	"github.com/uaad/backend/internal/domain"
	"github.com/uaad/backend/internal/middleware"
	"github.com/uaad/backend/internal/service"
	"gorm.io/gorm"
)

// EnrollmentWorker consumes enrollment messages from Kafka and persists
// them to MySQL. On transaction failure it compensates Redis via StockEngine.
type EnrollmentWorker struct {
	reader       *kafka.Reader
	db           *gorm.DB
	stockEngine  service.StockEngine
	notifSvc     service.NotificationService
	activityRepo interface {
		FindByID(id uint64) (*domain.Activity, error)
	}
}

// NewEnrollmentWorker creates a new worker.
func NewEnrollmentWorker(
	reader *kafka.Reader,
	db *gorm.DB,
	stockEngine service.StockEngine,
	notifSvc service.NotificationService,
	activityRepo interface {
		FindByID(id uint64) (*domain.Activity, error)
	},
) *EnrollmentWorker {
	return &EnrollmentWorker{
		reader:       reader,
		db:           db,
		stockEngine:  stockEngine,
		notifSvc:     notifSvc,
		activityRepo: activityRepo,
	}
}

// Run starts the consume loop. It blocks until ctx is cancelled.
func (w *EnrollmentWorker) Run(ctx context.Context) {
	log.Println("[EnrollWorker] started")
	for {
		msg, err := w.reader.ReadMessage(ctx)
		if err != nil {
			if ctx.Err() != nil {
				log.Println("[EnrollWorker] context cancelled, stopping")
				return
			}
			log.Printf("[EnrollWorker] read error: %v", err)
			time.Sleep(time.Second)
			continue
		}
		stats := w.reader.Stats()
		middleware.SetWorkerKafkaLag(stats.Topic, stats.Lag)
		w.handleMessage(ctx, msg)
	}
}

func (w *EnrollmentWorker) handleMessage(ctx context.Context, msg kafka.Message) {
	var em service.EnrollmentMessage
	if err := json.Unmarshal(msg.Value, &em); err != nil {
		log.Printf("[EnrollWorker] unmarshal error: %v, payload: %s", err, string(msg.Value))
		return
	}

	start := time.Now()
	now := time.Now()
	queuePos := int(em.QueuePos)
	updated := false

	err := w.db.Transaction(func(tx *gorm.DB) error {
		var current domain.Enrollment
		if err := tx.First(&current, em.EnrollmentID).Error; err != nil {
			return err
		}
		if current.Status != "QUEUING" {
			return nil
		}
		res := tx.Model(&domain.Enrollment{}).
			Where("id = ? AND status = ?", em.EnrollmentID, "QUEUING").
			Updates(map[string]interface{}{
				"status":         "SUCCESS",
				"queue_position": queuePos,
				"finalized_at":   now,
			})
		if res.Error != nil {
			return res.Error
		}
		if res.RowsAffected == 0 {
			return nil
		}
		updated = true

		order := domain.Order{
			OrderNo:      service.GenerateOrderNo(),
			EnrollmentID: em.EnrollmentID,
			UserID:       em.UserID,
			ActivityID:   em.ActivityID,
			Amount:       em.Price,
			Status:       "PENDING",
			ExpiredAt:    now.Add(15 * time.Minute),
		}
		if err := tx.Create(&order).Error; err != nil {
			return err
		}

		if err := tx.Model(&domain.Activity{}).
			Where("id = ? AND enroll_count < max_capacity", em.ActivityID).
			UpdateColumn("enroll_count", gorm.Expr("enroll_count + 1")).Error; err != nil {
			return err
		}

		return nil
	})

	if err != nil {
		activityTitle := resolveWorkerActivityTitle(w.activityRepo, em.ActivityID)
		log.Printf("[EnrollWorker] MySQL tx failed for enrollment=%d user=%d activity=%d: %v — rolling back Redis", em.EnrollmentID, em.UserID, em.ActivityID, err)
		if rbErr := w.stockEngine.Rollback(ctx, em.ActivityID, em.UserID); rbErr != nil {
			log.Printf("[EnrollWorker] CRITICAL: Redis rollback also failed: %v", rbErr)
		}
		// Mark enrollment FAILED so it stops being treated as in-flight.
		// Best-effort: if this update fails the row stays QUEUING and a future
		// reconciler must clean it up; we still notify the user.
		if updErr := w.db.Model(&domain.Enrollment{}).
			Where("id = ? AND status = ?", em.EnrollmentID, "QUEUING").
			Update("status", "FAILED").Error; updErr != nil {
			log.Printf("[EnrollWorker] failed to mark enrollment=%d FAILED: %v", em.EnrollmentID, updErr)
		}
		w.notifSvc.NotifyEnrollFail(em.UserID, em.EnrollmentID, activityTitle)
		middleware.RecordWorkerMessage("failure", time.Since(start).Seconds())
		return
	}
	if !updated {
		log.Printf("[EnrollWorker] skip message: enrollment=%d status not QUEUING", em.EnrollmentID)
		middleware.RecordWorkerMessage("success", time.Since(start).Seconds())
		return
	}

	activityTitle := resolveWorkerActivityTitle(w.activityRepo, em.ActivityID)
	w.notifSvc.NotifyEnrollSuccess(em.UserID, em.EnrollmentID, activityTitle)
	middleware.RecordWorkerMessage("success", time.Since(start).Seconds())
}

// resolveWorkerActivityTitle returns the activity's title or a "活动 #<id>"
// fallback. Never returns the literal "unknown" (forbidden by SPRINT3 §三 task 1).
func resolveWorkerActivityTitle(repo interface {
	FindByID(id uint64) (*domain.Activity, error)
}, activityID uint64) string {
	if act, err := repo.FindByID(activityID); err == nil && act.Title != "" {
		return act.Title
	}
	log.Printf("[EnrollWorker] activity title lookup failed, using id fallback: activity=%d", activityID)
	return fmt.Sprintf("活动 #%d", activityID)
}
