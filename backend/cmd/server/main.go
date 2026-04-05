package main

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/joho/godotenv"
	"github.com/uaad/backend/internal/config"
	"github.com/uaad/backend/internal/domain"
	"github.com/uaad/backend/internal/handler"
	"github.com/uaad/backend/internal/middleware"
	"github.com/uaad/backend/internal/repository"
	"github.com/uaad/backend/internal/service"
	"golang.org/x/time/rate"
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

	sqlDB, err := db.DB()
	if err != nil {
		log.Fatalf("failed to get sql.DB: %v", err)
	}
	cfg.ApplyMySQLPool(sqlDB)

	// Auto-migrate all known entities
	if err := db.AutoMigrate(
		&domain.User{},
		&domain.Activity{},
		&domain.Enrollment{},
		&domain.Order{},
		&domain.Notification{},
		&domain.UserBehavior{},
		&domain.ActivityScore{},
	); err != nil {
		log.Fatalf("failed to migrate database: %v", err)
	}

	// ── Dependency Injection ────────────────────────────────────────
	userRepo := repository.NewUserRepository(db)
	authSvc := service.NewAuthService(userRepo, cfg.JWTSecret)
	authHandler := handler.NewAuthHandler(authSvc)

	activityRepo := repository.NewActivityRepository(db)
	enrollmentRepo := repository.NewEnrollmentRepository(db)
	orderRepo := repository.NewOrderRepository(db)
	notifRepo := repository.NewNotificationRepository(db)
	behaviorRepo := repository.NewBehaviorRepository(db)

	activitySvc := service.NewActivityService(activityRepo)
	notifSvc := service.NewNotificationService(notifRepo)
	enrollmentSvc := service.NewEnrollmentService(db, enrollmentRepo, activityRepo, orderRepo)
	orderSvc := service.NewOrderService(orderRepo, activityRepo)
	behaviorSvc := service.NewBehaviorService(behaviorRepo)

	activityHandler := handler.NewActivityHandler(activitySvc)
	enrollmentHandler := handler.NewEnrollmentHandler(enrollmentSvc)
	orderHandler := handler.NewOrderHandler(orderSvc)
	notifHandler := handler.NewNotificationHandler(notifSvc)
	behaviorHandler := handler.NewBehaviorHandler(behaviorSvc, cfg)

	// Rate limiter: 5 registration requests per minute
	regLimit := middleware.NewIPRateLimiter(rate.Limit(5.0/60.0), 5)

	// ── Router ──────────────────────────────────────────────────────
	r := gin.Default()

	r.Use(cors.New(cors.Config{
		AllowAllOrigins: true,
		AllowMethods:    []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:    []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:   []string{"Content-Length"},
		MaxAge:          12 * time.Hour,
	}))

	v1 := r.Group("/api/v1")
	{
		auth := v1.Group("/auth")
		{
			auth.POST("/register", middleware.RateLimitMiddleware(regLimit), authHandler.Register)
			auth.POST("/login", authHandler.Login)
		}

		// Protected routes (require JWT authentication)
		protected := v1.Group("", middleware.JWTAuth(cfg.JWTSecret))
		{
			protected.GET("/auth/profile", authHandler.GetCurrentUser)
		}

		// ── Module Routes ───────────────────────────────────────
		handler.RegisterActivityRoutes(v1, activityHandler, cfg.JWTSecret)
		handler.RegisterEnrollmentRoutes(v1, enrollmentHandler, cfg.JWTSecret)
		handler.RegisterOrderRoutes(v1, orderHandler, cfg.JWTSecret)
		handler.RegisterNotificationRoutes(v1, notifHandler, cfg.JWTSecret)
		handler.RegisterBehaviorRoutes(v1, behaviorHandler, cfg.JWTSecret)
	}

	// Health check
	r.GET("/health", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{"status": "ok"})
	})

	// ── Order Expiry Scanner (every 5 minutes) ─────────────────────────
	go func() {
		ticker := time.NewTicker(5 * time.Minute)
		defer ticker.Stop()
		for range ticker.C {
			closed, err := orderSvc.ScanExpired()
			if err != nil {
				log.Printf("[OrderExpiry] scan error: %v", err)
			} else if closed > 0 {
				log.Printf("[OrderExpiry] closed %d expired orders, stock rolled back", closed)
			}
		}
	}()

	log.Printf("Server starting on :%s", cfg.Port)
	if err := r.Run(":" + cfg.Port); err != nil {
		log.Fatalf("failed to run server: %v", err)
	}
}
