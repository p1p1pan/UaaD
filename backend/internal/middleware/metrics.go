package middleware

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
)

var (
	httpRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests.",
		},
		[]string{"method", "path", "status"},
	)

	httpRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "HTTP request latency in seconds.",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)

	// Kafka enrollment worker async chain (SPRINT3 observability).
	workerMessagesProcessedTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "worker_messages_processed_total",
			Help: "Enrollment Kafka worker messages processed (success or failure).",
		},
		[]string{"status"},
	)

	workerMessageProcessingDurationSeconds = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "worker_message_processing_duration_seconds",
			Help:    "Time spent processing one enrollment message (seconds).",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"status"},
	)

	workerKafkaLagApprox = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "worker_kafka_lag_approx",
			Help: "Approximate consumer lag from kafka-go Reader stats (per topic).",
		},
		[]string{"topic"},
	)
)

func init() {
	prometheus.MustRegister(
		httpRequestsTotal,
		httpRequestDuration,
		workerMessagesProcessedTotal,
		workerMessageProcessingDurationSeconds,
		workerKafkaLagApprox,
	)

	// Pre-initialize key label combinations so Prometheus exposes zero-valued
	// series from startup. Without this, Grafana shows N/A until the first
	// real request hits each path (Go prometheus client is lazy).
	for _, path := range []string{
		"/api/v1/enrollments",
		"/api/v1/activities",
		"/api/v1/orders",
		"/api/v1/recommendations",
		"/api/v1/behaviors",
		"/api/v1/notifications",
		"/api/v1/auth/login",
		"/health",
	} {
		httpRequestsTotal.WithLabelValues("GET", path, "200")
		httpRequestsTotal.WithLabelValues("POST", path, "200")
		httpRequestDuration.WithLabelValues("GET", path)
		httpRequestDuration.WithLabelValues("POST", path)
	}
	for _, status := range []string{"200", "202", "400", "401", "403", "404", "409", "410", "500"} {
		httpRequestsTotal.WithLabelValues("POST", "/api/v1/enrollments", status)
	}
	workerMessagesProcessedTotal.WithLabelValues("success")
	workerMessagesProcessedTotal.WithLabelValues("failure")
	workerMessageProcessingDurationSeconds.WithLabelValues("success")
	workerMessageProcessingDurationSeconds.WithLabelValues("failure")
	workerKafkaLagApprox.WithLabelValues("enrollment")
}

// PrometheusMiddleware returns a Gin middleware that records request count
// and latency for every HTTP request.
func PrometheusMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		c.Next()

		elapsed := time.Since(start).Seconds()
		status := strconv.Itoa(c.Writer.Status())
		path := c.FullPath()
		if path == "" {
			path = c.Request.URL.Path
		}
		method := c.Request.Method

		httpRequestsTotal.WithLabelValues(method, path, status).Inc()
		httpRequestDuration.WithLabelValues(method, path).Observe(elapsed)
	}
}

// RecordWorkerMessage records enrollment worker throughput and per-message
// processing duration. status should be "success" or "failure".
func RecordWorkerMessage(status string, durationSec float64) {
	workerMessagesProcessedTotal.WithLabelValues(status).Inc()
	workerMessageProcessingDurationSeconds.WithLabelValues(status).Observe(durationSec)
}

// SetWorkerKafkaLag exports kafka-go reader lag as a gauge (optional backlog signal).
func SetWorkerKafkaLag(topic string, lag int64) {
	if topic == "" {
		topic = "unknown"
	}
	workerKafkaLagApprox.WithLabelValues(topic).Set(float64(lag))
}
