package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/uaad/backend/internal/middleware"
)

// RegisterOrderRoutes registers all order-related routes.
// All endpoints require JWT authentication.
func RegisterOrderRoutes(v1 *gin.RouterGroup, h *OrderHandler, jwtSecret string) {
	orders := v1.Group("/orders", middleware.JWTAuth(jwtSecret))
	{
		orders.GET("", h.List)
		orders.GET("/:id", h.Detail)
		orders.POST("/:id/pay", h.Pay)
	}
}
