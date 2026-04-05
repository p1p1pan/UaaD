// Package main provides a seed script that populates the database with test data.
// Usage: from backend/ directory run go run ./scripts/seed
package main

import (
	"fmt"
	"log"
	"time"

	"github.com/joho/godotenv"
	"github.com/uaad/backend/internal/config"
	"github.com/uaad/backend/internal/domain"
	"golang.org/x/crypto/bcrypt"
	gormmysql "gorm.io/driver/mysql"
	"gorm.io/gorm"
)

func main() {
	_ = godotenv.Load(".env")
	_ = godotenv.Load("../.env")

	cfg := config.Load()
	db, err := gorm.Open(gormmysql.Open(cfg.MySQLDSN()), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}
	sqlDB, _ := db.DB()
	defer sqlDB.Close()
	cfg.ApplyMySQLPool(sqlDB)

	// AutoMigrate all known models
	if err := db.AutoMigrate(
		&domain.User{},
		&domain.Activity{},
		&domain.Enrollment{},
		&domain.Order{},
		&domain.UserBehavior{},
		&domain.Notification{},
		&domain.ActivityScore{},
	); err != nil {
		log.Fatalf("failed to migrate: %v", err)
	}

	// Hash a shared test password
	hash, err := bcrypt.GenerateFromPassword([]byte("test123456"), bcrypt.DefaultCost)
	if err != nil {
		log.Fatalf("failed to hash password: %v", err)
	}
	hashed := string(hash)

	// --- Users ---
	users := []domain.User{
		{Phone: "13800000001", Username: "测试用户1", PasswordHash: hashed, Role: "USER"},
		{Phone: "13800000002", Username: "测试用户2", PasswordHash: hashed, Role: "USER"},
		{Phone: "13800000003", Username: "测试用户3", PasswordHash: hashed, Role: "USER"},
		{Phone: "13800000004", Username: "李明商户", PasswordHash: hashed, Role: "MERCHANT"},
		{Phone: "13800000005", Username: "王芳商户", PasswordHash: hashed, Role: "MERCHANT"},
	}

	createdUsers := make([]domain.User, 0, len(users))
	for i, u := range users {
		result := db.Where("phone = ?", u.Phone).FirstOrCreate(&users[i])
		if result.Error != nil {
			log.Fatalf("failed to seed user %d: %v", i+1, result.Error)
		}
		createdUsers = append(createdUsers, users[i])
	}
	fmt.Printf("✅ %d users seeded\n", len(createdUsers))

	merchantIDs := []uint64{createdUsers[3].ID, createdUsers[4].ID}

	// --- Activities ---
	categories := []string{"CONCERT", "CONFERENCE", "EXPO", "ESPORTS", "EXHIBITION"}
	statuses := []string{"PUBLISHED", "PREHEAT", "DRAFT", "PUBLISHED", "PUBLISHED"}
	now := time.Now()

	for i := 1; i <= 20; i++ {
		cat := categories[i%len(categories)]
		st := statuses[i%len(statuses)]
		creator := merchantIDs[i%len(merchantIDs)]

		activity := &domain.Activity{
			Title:         fmt.Sprintf("模拟活动 #%d", i),
			Description:   fmt.Sprintf("这是一个自动生成的测试活动，编号 %d。活动描述内容丰富多彩，吸引用户关注。", i),
			Location:      fmt.Sprintf("城市 %d 号场馆", i%5+1),
			Category:      cat,
			Price:         float64(i) * 50.0,
			Status:        st,
			CreatedBy:     creator,
			MaxCapacity:   10000 + i*1000,
			EnrollOpenAt:  now.Add(time.Duration(-24+i) * time.Hour),
			EnrollCloseAt: now.Add(time.Duration(48+i*2) * time.Hour),
			ActivityAt:    now.Add(time.Duration(72+i*3) * time.Hour),
			EnrollCount:   int64(i * 500),
			ViewCount:     int64(i * 1234),
		}

		tags := "[\"测试\",\"热门\"]"
		activity.Tags = &tags

		result := db.Where("title = ?", activity.Title).FirstOrCreate(activity)
		if result.Error != nil {
			log.Printf("warning: failed to seed activity #%d: %v", i, result.Error)
			continue
		}
	}
	fmt.Println("✅ 20 activities seeded")

	fmt.Println("\n🎉 Seed complete! Run `go run ./cmd/server` to start the API.")
}
