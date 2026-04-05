package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/uaad/backend/internal/middleware"
)

// RegisterNotificationRoutes registers notification endpoints (JWT required).
func RegisterNotificationRoutes(v1 *gin.RouterGroup, h *NotificationHandler, jwtSecret string) {
	g := v1.Group("/notifications", middleware.JWTAuth(jwtSecret))
	{
		g.GET("/unread-count", h.UnreadCount)
		g.GET("", h.List)
		g.PUT("/:id/read", h.MarkRead)
	}
}
