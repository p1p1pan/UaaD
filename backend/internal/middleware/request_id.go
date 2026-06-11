package middleware

import (
	"crypto/rand"
	"encoding/hex"
	"time"

	"github.com/gin-gonic/gin"
)

const requestIDContextKey = "request_id"

// RequestID injects a request id into gin context and response header.
// If client already sends X-Request-ID, it will be reused.
func RequestID() gin.HandlerFunc {
	return func(c *gin.Context) {
		requestID := c.GetHeader("X-Request-ID")
		if requestID == "" {
			requestID = generateRequestID()
		}
		c.Set(requestIDContextKey, requestID)
		c.Header("X-Request-ID", requestID)
		c.Next()
	}
}

// GetRequestID returns request id from context if available.
func GetRequestID(c *gin.Context) string {
	if c == nil {
		return ""
	}
	v, ok := c.Get(requestIDContextKey)
	if !ok {
		return ""
	}
	id, ok := v.(string)
	if !ok {
		return ""
	}
	return id
}

func generateRequestID() string {
	var raw [16]byte
	if _, err := rand.Read(raw[:]); err != nil {
		return "req-" + time.Now().Format("20060102150405.000000000")
	}
	return hex.EncodeToString(raw[:])
}
