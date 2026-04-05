package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/uaad/backend/internal/service"
	"github.com/uaad/backend/pkg/response"
)

// NotificationHandler handles notification APIs for C-end users.
type NotificationHandler struct {
	svc service.NotificationService
}

// NewNotificationHandler creates a NotificationHandler.
func NewNotificationHandler(svc service.NotificationService) *NotificationHandler {
	return &NotificationHandler{svc: svc}
}

// List handles GET /api/v1/notifications.
func (h *NotificationHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	userID := getUserID(c)
	list, total, err := h.svc.List(userID, page, pageSize)
	if err != nil {
		response.InternalError(c, "获取通知列表失败")
		return
	}
	response.Paginated(c, list, total, page, pageSize)
}

// UnreadCount handles GET /api/v1/notifications/unread-count.
func (h *NotificationHandler) UnreadCount(c *gin.Context) {
	userID := getUserID(c)
	n, err := h.svc.UnreadCount(userID)
	if err != nil {
		response.InternalError(c, "获取未读数量失败")
		return
	}
	response.Success(c, gin.H{"unread_count": n})
}

// MarkRead handles PUT /api/v1/notifications/:id/read.
func (h *NotificationHandler) MarkRead(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的通知 ID")
		return
	}
	userID := getUserID(c)
	if err := h.svc.MarkRead(id, userID); err != nil {
		if err == service.ErrNotificationNotFound {
			response.NotFound(c, "通知不存在")
			return
		}
		response.InternalError(c, "标记已读失败")
		return
	}
	response.Success(c, gin.H{"id": id, "is_read": true})
}
