package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/uaad/backend/internal/domain"
	"github.com/uaad/backend/internal/handler"
	"github.com/uaad/backend/internal/middleware"
	"github.com/uaad/backend/internal/repository"
	"github.com/uaad/backend/internal/service"
	"golang.org/x/time/rate"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
)

func main() {
	// ── Configuration ───────────────────────────────────────────────
	jwtSecret := getEnv("JWT_SECRET", "uaad-super-secret-key-2026")
	dbPath := getEnv("DB_PATH", "uaad.db")
	port := getEnv("PORT", "8080")

	// ── Database ────────────────────────────────────────────────────
	db, err := gorm.Open(sqlite.Open(dbPath), &gorm.Config{})
	if err != nil {
		log.Fatalf("failed to connect database: %v", err)
	}

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("failed to get sql.DB: %v", err)
	}
	sqlDB.SetMaxIdleConns(10)
	sqlDB.SetMaxOpenConns(100)
	sqlDB.SetConnMaxLifetime(time.Hour)

	// Auto-migrate all known entities
	if err := db.AutoMigrate(&domain.User{}); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	// ── Dependency Injection ────────────────────────────────────────
	userRepo := repository.NewUserRepository(db)
	authSvc := service.NewAuthService(userRepo, jwtSecret)
	authHandler := handler.NewAuthHandler(authSvc)

	// Rate limiter: 5 registration requests per minute
	regLimit := middleware.NewIPRateLimiter(rate.Limit(5.0/60.0), 5)

	// ── Router ──────────────────────────────────────────────────────
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173", "http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	v1 := r.Group("/api/v1")
	{
		auth := v1.Group("/auth")
		{
			auth.POST("/register", middleware.RateLimitMiddleware(regLimit), authHandler.Register)
			auth.POST("/login", authHandler.Login)
		}

		// Protected routes (require JWT authentication)
		protected := v1.Group("", middleware.JWTAuth(jwtSecret))
		{
			protected.GET("/auth/profile", authHandler.GetCurrentUser)
		}
	}

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	log.Printf("Server starting on %s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("failed to run server: %v", err)
	}
}

func getEnv(key, fallback string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallback
}
