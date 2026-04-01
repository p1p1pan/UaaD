// Package response provides unified API response formatting for all handlers.
//
// All handlers must use this package instead of directly calling c.JSON().
// Response format follows the contract defined in docs/SYSTEM_DESIGN.md §4.2.
package response

import "github.com/gin-gonic/gin"

// ListResponse wraps paginated data for list endpoints.
type ListResponse struct {
	List     interface{} `json:"list"`
	Total    int64       `json:"total"`
	Page     int         `json:"page"`
	PageSize int         `json:"page_size"`
}

// Success returns a 200 OK response with data.
func Success(c *gin.Context, data interface{}) {
	c.JSON(200, gin.H{
		"code":    0,
		"message": "ok",
		"data":    data,
	})
}

// Created returns a 201 response with data.
func Created(c *gin.Context, data interface{}) {
	c.JSON(201, gin.H{
		"code":    0,
		"message": "created",
		"data":    data,
	})
}

// Accepted returns a 202 Accepted response (used for queuing).
func Accepted(c *gin.Context, data interface{}) {
	c.JSON(202, gin.H{
		"code":    1201,
		"message": "已进入排队队列，请等待结果",
		"data":    data,
	})
}

// BadRequest returns a 400 response with error message.
func BadRequest(c *gin.Context, msg string) {
	c.JSON(400, gin.H{
		"code":    1001,
		"message": msg,
		"data":    nil,
	})
}

// Unauthorized returns a 401 response.
func Unauthorized(c *gin.Context, msg string) {
	if msg == "" {
		msg = "未认证或Token已过期"
	}
	c.JSON(401, gin.H{
		"code":    1002,
		"message": msg,
		"data":    nil,
	})
}

// Forbidden returns a 403 response.
func Forbidden(c *gin.Context, msg string) {
	if msg == "" {
		msg = "权限不足"
	}
	c.JSON(403, gin.H{
		"code":    1003,
		"message": msg,
		"data":    nil,
	})
}

// NotFound returns a 404 response.
func NotFound(c *gin.Context, msg string) {
	if msg == "" {
		msg = "资源不存在"
	}
	c.JSON(404, gin.H{
		"code":    1004,
		"message": msg,
		"data":    nil,
	})
}

// Conflict returns a 409 response.
func Conflict(c *gin.Context, msg string) {
	c.JSON(409, gin.H{
		"code":    1005,
		"message": msg,
		"data":    nil,
	})
}

// TooManyRequests returns a 429 response.
func TooManyRequests(c *gin.Context) {
	c.JSON(429, gin.H{
		"code":    1006,
		"message": "请求过快，请稍后重试",
		"data":    nil,
	})
}

// InternalError returns a 500 response.
func InternalError(c *gin.Context, msg string) {
	if msg == "" {
		msg = "内部服务器错误"
	}
	c.JSON(500, gin.H{
		"code":    5000,
		"message": msg,
		"data":    nil,
	})
}

// Paginated returns a 200 response with paginated list data.
func Paginated(c *gin.Context, list interface{}, total int64, page, pageSize int) {
	c.JSON(200, gin.H{
		"code":    0,
		"message": "ok",
		"data": ListResponse{
			List:     list,
			Total:    total,
			Page:     page,
			PageSize: pageSize,
		},
	})
}
