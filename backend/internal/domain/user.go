package domain

import (
	"gorm.io/gorm"
	"time"
)

type User struct {
	ID           uint64         `gorm:"primaryKey" json:"id"`
	Phone        string         `gorm:"uniqueIndex;not null;size:20" json:"phone"`
	Username     string         `gorm:"not null;size:50" json:"username"`
	PasswordHash string         `gorm:"not null" json:"-"`
	Role         string         `gorm:"default:'USER'" json:"role"`
	CreatedAt    time.Time      `json:"created_at"`
	UpdatedAt    time.Time      `json:"updated_at"`
	DeletedAt    gorm.DeletedAt `gorm:"index" json:"-"`
}
