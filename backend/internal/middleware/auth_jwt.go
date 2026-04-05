package middleware

import (
	"github.com/gin-gonic/gin"
	"github.com/uaad/backend/pkg/jwtutil"
	"github.com/uaad/backend/pkg/response"
	"strings"
)

// JWTAuth returns a gin middleware that validates JWT tokens.
// It extracts the token from the Authorization header, validates it,
// and injects user_id and role into the gin.Context.
//
// Usage:
//   protected := r.Group("/api/v1", middleware.JWTAuth(secret))
//   protected.GET("/profile", handler.GetProfile)
func JWTAuth(secret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			response.Unauthorized(c, "缺少认证令牌")
			c.Abort()
			return
		}

		// Extract "Bearer <token>"
		parts := strings.SplitN(authHeader, " ", 2)
		if len(parts) != 2 || parts[0] != "Bearer" {
			response.Unauthorized(c, "认证格式无效")
			c.Abort()
			return
		}

		claims, err := jwtutil.ValidateToken(parts[1], secret)
		if err != nil {
			response.Unauthorized(c, "认证令牌无效或已过期")
			c.Abort()
			return
		}

		// Inject claims into context for downstream handlers
		c.Set("user_id", claims.UserID)
		c.Set("role", claims.Role)
		c.Next()
	}
}

// RequireRole returns a middleware that checks if the authenticated user
// has one of the allowed roles. Must be used after JWTAuth.
func RequireRole(allowedRoles ...string) gin.HandlerFunc {
	return func(c *gin.Context) {
		userRole, exists := c.Get("role")
		if !exists {
			response.Forbidden(c, "无法确定用户角色")
			c.Abort()
			return
		}

		roleStr, ok := userRole.(string)
		if !ok {
			response.Forbidden(c, "角色类型异常")
			c.Abort()
			return
		}

		for _, allowed := range allowedRoles {
			if roleStr == allowed {
				c.Next()
				return
			}
		}

		response.Forbidden(c, "权限不足，需要角色: "+strings.Join(allowedRoles, "/"))
		c.Abort()
	}
}
