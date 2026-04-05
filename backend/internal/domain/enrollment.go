package domain

import (
	"time"
)

// Status values: QUEUING, SUCCESS, FAILED, CANCELLED
type Enrollment struct {
	ID            uint64     `gorm:"primaryKey" json:"id"`
	UserID        uint64     `gorm:"not null;uniqueIndex:idx_user_activity" json:"user_id"`
	ActivityID    uint64     `gorm:"not null;uniqueIndex:idx_user_activity" json:"activity_id"`
	Status        string     `gorm:"type:varchar(20);not null;default:'QUEUING'" json:"status"`
	QueuePosition *int       `json:"queue_position"`
	EnrolledAt    time.Time  `gorm:"not null" json:"enrolled_at"`
	FinalizedAt   *time.Time `json:"finalized_at"`
}
