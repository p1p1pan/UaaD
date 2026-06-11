package handler

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/uaad/backend/internal/domain"
	"github.com/uaad/backend/internal/service"
)

// ── Stub OrderService ───────────────────────────────────────────────────────

type stubOrderService struct {
	listResult   []domain.Order
	listTotal    int64
	listErr      error
	detailResult *domain.Order
	detailErr    error
	payResult    *service.PayResult
	payErr       error
	lastUserID   uint64
	lastOrderID  uint64
	lastPage     int
	lastPageSize int
}

func (s *stubOrderService) ListByUser(userID uint64, page, pageSize int) ([]domain.Order, int64, error) {
	s.lastUserID = userID
	s.lastPage = page
	s.lastPageSize = pageSize
	if s.listErr != nil {
		return nil, 0, s.listErr
	}
	return s.listResult, s.listTotal, nil
}

func (s *stubOrderService) Detail(orderID, userID uint64) (*domain.Order, error) {
	s.lastOrderID = orderID
	s.lastUserID = userID
	if s.detailErr != nil {
		return nil, s.detailErr
	}
	return s.detailResult, nil
}

func (s *stubOrderService) Pay(orderID, userID uint64) (*service.PayResult, error) {
	s.lastOrderID = orderID
	s.lastUserID = userID
	if s.payErr != nil {
		return nil, s.payErr
	}
	return s.payResult, nil
}

func (s *stubOrderService) ScanExpired() (int, error) {
	return 0, nil
}

// ── Test Cases ──────────────────────────────────────────────────────────────

func TestOrderHandler_List_OK(t *testing.T) {
	gin.SetMode(gin.TestMode)

	stub := &stubOrderService{
		listResult: []domain.Order{
			{ID: 1, OrderNo: "ORD202604060001", Status: "PENDING"},
			{ID: 2, OrderNo: "ORD202604060002", Status: "PAID"},
		},
		listTotal: 2,
	}
	h := NewOrderHandler(stub)

	r := gin.New()
	r.GET("/api/v1/orders", func(c *gin.Context) {
		c.Set("user_id", uint64(99))
		h.List(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/orders?page=1&page_size=20", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]interface{})
	if data["total"].(float64) != 2 {
		t.Errorf("want total=2, got %v", data["total"])
	}
	if stub.lastUserID != 99 {
		t.Errorf("want userID=99, got %d", stub.lastUserID)
	}
	if stub.lastPage != 1 {
		t.Errorf("want page=1, got %d", stub.lastPage)
	}
}

func TestOrderHandler_List_DefaultPagination(t *testing.T) {
	gin.SetMode(gin.TestMode)

	stub := &stubOrderService{
		listResult: []domain.Order{},
		listTotal:  0,
	}
	h := NewOrderHandler(stub)

	r := gin.New()
	r.GET("/api/v1/orders", func(c *gin.Context) {
		c.Set("user_id", uint64(99))
		h.List(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/orders", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", w.Code)
	}
	if stub.lastPage != 1 {
		t.Errorf("want default page=1, got %d", stub.lastPage)
	}
	if stub.lastPageSize != 20 {
		t.Errorf("want default pageSize=20, got %d", stub.lastPageSize)
	}
}

func TestOrderHandler_List_InternalError(t *testing.T) {
	gin.SetMode(gin.TestMode)

	stub := &stubOrderService{listErr: errors.New("db error")}
	h := NewOrderHandler(stub)

	r := gin.New()
	r.GET("/api/v1/orders", func(c *gin.Context) {
		c.Set("user_id", uint64(99))
		h.List(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/orders", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("want 500, got %d", w.Code)
	}
}

func TestOrderHandler_Detail_OK(t *testing.T) {
	gin.SetMode(gin.TestMode)

	stub := &stubOrderService{
		detailResult: &domain.Order{
			ID:      123,
			OrderNo: "ORD202604060001",
			Status:  "PENDING",
			Amount:  99.0,
		},
	}
	h := NewOrderHandler(stub)

	r := gin.New()
	r.GET("/api/v1/orders/:id", func(c *gin.Context) {
		c.Set("user_id", uint64(99))
		h.Detail(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/orders/123", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]interface{})
	if data["order_no"] != "ORD202604060001" {
		t.Errorf("want order_no=ORD202604060001, got %v", data["order_no"])
	}
	if stub.lastOrderID != 123 {
		t.Errorf("want orderID=123, got %d", stub.lastOrderID)
	}
}

func TestOrderHandler_Detail_InvalidID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	stub := &stubOrderService{}
	h := NewOrderHandler(stub)

	r := gin.New()
	r.GET("/api/v1/orders/:id", h.Detail)

	req := httptest.NewRequest(http.MethodGet, "/api/v1/orders/abc", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d", w.Code)
	}
}

func TestOrderHandler_Detail_NotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)

	stub := &stubOrderService{detailErr: service.ErrOrderNotFound}
	h := NewOrderHandler(stub)

	r := gin.New()
	r.GET("/api/v1/orders/:id", func(c *gin.Context) {
		c.Set("user_id", uint64(99))
		h.Detail(c)
	})

	req := httptest.NewRequest(http.MethodGet, "/api/v1/orders/999", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("want 404, got %d", w.Code)
	}
}

func TestOrderHandler_Pay_OK(t *testing.T) {
	gin.SetMode(gin.TestMode)

	now := time.Now()
	stub := &stubOrderService{
		payResult: &service.PayResult{
			OrderNo: "ORD202604060001",
			Status:  "PAID",
			PaidAt:  now,
		},
	}
	h := NewOrderHandler(stub)

	r := gin.New()
	r.POST("/api/v1/orders/:id/pay", func(c *gin.Context) {
		c.Set("user_id", uint64(99))
		h.Pay(c)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/123/pay", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", w.Code)
	}

	var resp map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &resp)
	data := resp["data"].(map[string]interface{})
	if data["status"] != "PAID" {
		t.Errorf("want status=PAID, got %v", data["status"])
	}
	if stub.lastOrderID != 123 {
		t.Errorf("want orderID=123, got %d", stub.lastOrderID)
	}
	if stub.lastUserID != 99 {
		t.Errorf("want userID=99, got %d", stub.lastUserID)
	}
}

func TestOrderHandler_Pay_InvalidID(t *testing.T) {
	gin.SetMode(gin.TestMode)

	stub := &stubOrderService{}
	h := NewOrderHandler(stub)

	r := gin.New()
	r.POST("/api/v1/orders/:id/pay", h.Pay)

	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/abc/pay", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d", w.Code)
	}
}

func TestOrderHandler_Pay_OrderNotFound(t *testing.T) {
	gin.SetMode(gin.TestMode)

	stub := &stubOrderService{payErr: service.ErrOrderNotFound}
	h := NewOrderHandler(stub)

	r := gin.New()
	r.POST("/api/v1/orders/:id/pay", func(c *gin.Context) {
		c.Set("user_id", uint64(99))
		h.Pay(c)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/999/pay", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Fatalf("want 404, got %d", w.Code)
	}
}

func TestOrderHandler_Pay_OrderNotPending(t *testing.T) {
	gin.SetMode(gin.TestMode)

	stub := &stubOrderService{payErr: service.ErrOrderNotPending}
	h := NewOrderHandler(stub)

	r := gin.New()
	r.POST("/api/v1/orders/:id/pay", func(c *gin.Context) {
		c.Set("user_id", uint64(99))
		h.Pay(c)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/123/pay", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d", w.Code)
	}
}

func TestOrderHandler_Pay_OrderExpired(t *testing.T) {
	gin.SetMode(gin.TestMode)

	stub := &stubOrderService{payErr: service.ErrOrderExpired}
	h := NewOrderHandler(stub)

	r := gin.New()
	r.POST("/api/v1/orders/:id/pay", func(c *gin.Context) {
		c.Set("user_id", uint64(99))
		h.Pay(c)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/123/pay", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d", w.Code)
	}
}

func TestOrderHandler_Pay_InternalError(t *testing.T) {
	gin.SetMode(gin.TestMode)

	stub := &stubOrderService{payErr: errors.New("payment gateway error")}
	h := NewOrderHandler(stub)

	r := gin.New()
	r.POST("/api/v1/orders/:id/pay", func(c *gin.Context) {
		c.Set("user_id", uint64(99))
		h.Pay(c)
	})

	req := httptest.NewRequest(http.MethodPost, "/api/v1/orders/123/pay", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Fatalf("want 500, got %d", w.Code)
	}
}
