package middleware

import (
	"strings"
	"time"

	"github.com/gin-contrib/cors"
)

// BuildCORSConfig builds a CORS policy according to runtime environment.
// - development/test: defaults to allow-all when no origin whitelist is provided.
// - production: defaults to deny-all unless explicit origins are configured.
func BuildCORSConfig(appEnv string, allowedOrigins []string) cors.Config {
	base := cors.Config{
		AllowMethods:  []string{"GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"},
		AllowHeaders:  []string{"Origin", "Content-Type", "Accept", "Authorization", "X-Request-ID"},
		ExposeHeaders: []string{"Content-Length", "X-Request-ID"},
		MaxAge:        12 * time.Hour,
	}

	if len(allowedOrigins) > 0 {
		base.AllowOrigins = allowedOrigins
		return base
	}

	if strings.EqualFold(appEnv, "production") {
		// secure-by-default in production
		base.AllowOrigins = []string{}
		base.AllowAllOrigins = false
		return base
	}

	base.AllowAllOrigins = true
	return base
}
