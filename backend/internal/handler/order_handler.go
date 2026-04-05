package handler

import (
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/uaad/backend/internal/service"
	"github.com/uaad/backend/pkg/response"
)

// OrderHandler handles order-related HTTP requests.
type OrderHandler struct {
	svc service.OrderService
}

// NewOrderHandler creates a new OrderHandler.
func NewOrderHandler(svc service.OrderService) *OrderHandler {
	return &OrderHandler{svc: svc}
}

// List handles GET /api/v1/orders.
func (h *OrderHandler) List(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))

	userID := getUserID(c)
	orders, total, err := h.svc.ListByUser(userID, page, pageSize)
	if err != nil {
		response.InternalError(c, "获取订单列表失败")
		return
	}

	response.Paginated(c, orders, total, page, pageSize)
}

// Detail handles GET /api/v1/orders/:id.
func (h *OrderHandler) Detail(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的订单 ID")
		return
	}

	userID := getUserID(c)
	order, err := h.svc.Detail(id, userID)
	if err != nil {
		response.NotFound(c, "订单不存在")
		return
	}

	response.Success(c, order)
}

// Pay handles POST /api/v1/orders/:id/pay.
func (h *OrderHandler) Pay(c *gin.Context) {
	id, err := strconv.ParseUint(c.Param("id"), 10, 64)
	if err != nil {
		response.BadRequest(c, "无效的订单 ID")
		return
	}

	userID := getUserID(c)
	result, err := h.svc.Pay(id, userID)
	if err != nil {
		switch err {
		case service.ErrOrderNotFound:
			response.NotFound(c, "订单不存在")
		case service.ErrOrderNotPending:
			response.BadRequest(c, "订单状态不允许支付")
		case service.ErrOrderExpired:
			response.BadRequest(c, "订单已过期")
		default:
			response.InternalError(c, "支付失败")
		}
		return
	}

	response.Success(c, gin.H{
		"order_no": result.OrderNo,
		"status":   result.Status,
		"paid_at":  result.PaidAt,
	})
}
