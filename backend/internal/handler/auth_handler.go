package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/uaad/backend/internal/service"
	"github.com/uaad/backend/pkg/response"
)

// AuthHandler handles authentication-related HTTP requests.
type AuthHandler struct {
	svc service.AuthService
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(svc service.AuthService) *AuthHandler {
	return &AuthHandler{svc: svc}
}

// RegisterRequest represents the JSON body for registration.
type RegisterRequest struct {
	Phone    string `json:"phone" binding:"required"`
	Username string `json:"username" binding:"required"`
	Password string `json:"password" binding:"required,min=6"`
}

// LoginRequest represents the JSON body for login.
type LoginRequest struct {
	Phone    string `json:"phone" binding:"required"`
	Password string `json:"password" binding:"required"`
}

// Register handles POST /api/v1/auth/register.
func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}

	if err := h.svc.Register(req.Phone, req.Username, req.Password); err != nil {
		if err == service.ErrUserAlreadyExists {
			response.Conflict(c, "该手机号已被注册")
			return
		}
		response.InternalError(c, "注册失败，请稍后重试")
		return
	}

	response.Created(c, nil)
}

// Login handles POST /api/v1/auth/login.
func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}

	loginResult, err := h.svc.Login(req.Phone, req.Password)
	if err != nil {
		if err == service.ErrInvalidCredentials {
			response.BadRequest(c, "手机号或密码错误")
			return
		}
		response.InternalError(c, "登录失败，请稍后重试")
		return
	}

	response.Success(c, loginResult)
}

// GetCurrentUser handles GET /api/v1/auth/profile.
// This handler requires JWT auth middleware to be applied.
func (h *AuthHandler) GetCurrentUser(c *gin.Context) {
	userID, _ := c.Get("user_id")
	role, _ := c.Get("role")

	user, err := h.svc.GetProfile(userID.(uint64))
	if err != nil {
		response.InternalError(c, "获取用户信息失败")
		return
	}

	response.Success(c, gin.H{
		"user_id":    user.ID,
		"phone":      user.Phone,
		"username":   user.Username,
		"role":       role,
		"created_at": user.CreatedAt,
	})
}
