package service

import (
	"encoding/json"
	"errors"
	"log"

	"github.com/uaad/backend/internal/domain"
	"github.com/uaad/backend/internal/repository"
)

var (
	ErrInvalidBehaviorType = errors.New("invalid behavior_type")
	ErrBehaviorBatchEmpty  = errors.New("batch items empty")
	ErrBehaviorBatchTooBig = errors.New("batch exceeds max size")
)

const behaviorBatchMax = 100

var allowedBehaviorTypes = map[string]struct{}{
	"VIEW":    {},
	"COLLECT": {},
	"SHARE":   {},
	"CLICK":   {},
	"SEARCH":  {},
}

// BehaviorSubmit is one behavior event from the client.
type BehaviorSubmit struct {
	ActivityID   uint64                 `json:"activity_id"`
	BehaviorType string                 `json:"behavior_type"`
	Detail       map[string]interface{} `json:"detail"`
}

// BehaviorService records user behaviors for recommendation analytics.
type BehaviorService interface {
	Submit(userID uint64, async bool, item BehaviorSubmit) error
	SubmitBatch(userID uint64, async bool, items []BehaviorSubmit) error
}

type behaviorService struct {
	repo repository.BehaviorRepository
}

// NewBehaviorService creates a BehaviorService.
func NewBehaviorService(repo repository.BehaviorRepository) BehaviorService {
	return &behaviorService{repo: repo}
}

func validateAndToDomain(userID uint64, item BehaviorSubmit) (*domain.UserBehavior, error) {
	if item.ActivityID == 0 {
		return nil, errors.New("activity_id required")
	}
	if _, ok := allowedBehaviorTypes[item.BehaviorType]; !ok {
		return nil, ErrInvalidBehaviorType
	}
	var detailStr *string
	if len(item.Detail) > 0 {
		b, err := json.Marshal(item.Detail)
		if err != nil {
			return nil, err
		}
		s := string(b)
		detailStr = &s
	}
	return &domain.UserBehavior{
		UserID:       userID,
		ActivityID:   item.ActivityID,
		BehaviorType: item.BehaviorType,
		Detail:       detailStr,
	}, nil
}

func (s *behaviorService) Submit(userID uint64, async bool, item BehaviorSubmit) error {
	b, err := validateAndToDomain(userID, item)
	if err != nil {
		return err
	}
	if async {
		clone := *b
		go func() {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("[behavior] async submit panic: %v", r)
				}
			}()
			if err := s.repo.Create(&clone); err != nil {
				log.Printf("[behavior] async create: %v", err)
			}
		}()
		return nil
	}
	return s.repo.Create(b)
}

func (s *behaviorService) SubmitBatch(userID uint64, async bool, items []BehaviorSubmit) error {
	if len(items) == 0 {
		return ErrBehaviorBatchEmpty
	}
	if len(items) > behaviorBatchMax {
		return ErrBehaviorBatchTooBig
	}
	rows := make([]*domain.UserBehavior, 0, len(items))
	for i := range items {
		b, err := validateAndToDomain(userID, items[i])
		if err != nil {
			return err
		}
		rows = append(rows, b)
	}
	if async {
		cp := make([]*domain.UserBehavior, len(rows))
		for i, r := range rows {
			c := *r
			cp[i] = &c
		}
		go func(list []*domain.UserBehavior) {
			defer func() {
				if r := recover(); r != nil {
					log.Printf("[behavior] async batch panic: %v", r)
				}
			}()
			if err := s.repo.BatchCreate(list); err != nil {
				log.Printf("[behavior] async batch create: %v", err)
			}
		}(cp)
		return nil
	}
	return s.repo.BatchCreate(rows)
}
