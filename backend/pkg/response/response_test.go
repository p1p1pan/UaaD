package response

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
)

func init() {
	gin.SetMode(gin.TestMode)
}

func execHandler(handler func(*gin.Context)) *httptest.ResponseRecorder {
	w := httptest.NewRecorder()
	c, _ := gin.CreateTestContext(w)
	c.Request = httptest.NewRequest("GET", "/", nil)
	handler(c)
	return w
}

func TestSuccess(t *testing.T) {
	w := execHandler(func(c *gin.Context) {
		Success(c, gin.H{"id": 1})
	})
	if w.Code != 200 {
		t.Errorf("status: got %d, want 200", w.Code)
	}
	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	if body["code"].(float64) != 0 {
		t.Errorf("code: got %v, want 0", body["code"])
	}
}

func TestCreated(t *testing.T) {
	w := execHandler(func(c *gin.Context) {
		Created(c, nil)
	})
	if w.Code != 201 {
		t.Errorf("status: got %d, want 201", w.Code)
	}
}

func TestBadRequest(t *testing.T) {
	w := execHandler(func(c *gin.Context) {
		BadRequest(c, "invalid")
	})
	if w.Code != 400 {
		t.Errorf("status: got %d, want 400", w.Code)
	}
	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)
	if body["code"].(float64) != 1001 {
		t.Errorf("code: got %v, want 1001", body["code"])
	}
}

func TestUnauthorized(t *testing.T) {
	w := execHandler(func(c *gin.Context) {
		Unauthorized(c, "")
	})
	if w.Code != 401 {
		t.Errorf("status: got %d, want 401", w.Code)
	}
}

func TestForbidden(t *testing.T) {
	w := execHandler(func(c *gin.Context) {
		Forbidden(c, "")
	})
	if w.Code != 403 {
		t.Errorf("status: got %d, want 403", w.Code)
	}
}

func TestNotFound(t *testing.T) {
	w := execHandler(func(c *gin.Context) {
		NotFound(c, "")
	})
	if w.Code != http.StatusNotFound {
		t.Errorf("status: got %d, want 404", w.Code)
	}
}

func TestPaginated(t *testing.T) {
	w := execHandler(func(c *gin.Context) {
		Paginated(c, []string{"a", "b"}, 100, 1, 20)
	})
	var body map[string]interface{}
	json.Unmarshal(w.Body.Bytes(), &body)

	data := body["data"].(map[string]interface{})
	if data["total"].(float64) != 100 {
		t.Errorf("total: got %v, want 100", data["total"])
	}
	if data["page"].(float64) != 1 {
		t.Errorf("page: got %v, want 1", data["page"])
	}
	list := data["list"].([]interface{})
	if len(list) != 2 {
		t.Errorf("list len: got %d, want 2", len(list))
	}
}
