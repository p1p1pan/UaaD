package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/uaad/backend/internal/middleware"
)

// RegisterBehaviorRoutes registers behavior tracking endpoints (JWT required).
func RegisterBehaviorRoutes(v1 *gin.RouterGroup, h *BehaviorHandler, jwtSecret string) {
	g := v1.Group("/behaviors", middleware.JWTAuth(jwtSecret))
	{
		g.POST("", h.Submit)
		g.POST("/batch", h.SubmitBatch)
	}
}
