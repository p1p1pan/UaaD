package handler

import (
	"github.com/gin-gonic/gin"
	"github.com/uaad/backend/internal/config"
	"github.com/uaad/backend/internal/service"
	"github.com/uaad/backend/pkg/response"
)

// BehaviorHandler handles behavior tracking APIs.
type BehaviorHandler struct {
	svc service.BehaviorService
	cfg *config.Config
}

// NewBehaviorHandler creates a BehaviorHandler.
func NewBehaviorHandler(svc service.BehaviorService, cfg *config.Config) *BehaviorHandler {
	return &BehaviorHandler{svc: svc, cfg: cfg}
}

// behaviorSingleRequest is the JSON body for POST /behaviors and each element of POST /behaviors/batch.
type behaviorSingleRequest struct {
	ActivityID   uint64                 `json:"activity_id" binding:"required"`
	BehaviorType string                 `json:"behavior_type" binding:"required"`
	Detail       map[string]interface{} `json:"detail"`
	Timestamp    *int64                 `json:"timestamp,omitempty"`
}

// Submit handles POST /api/v1/behaviors.
func (h *BehaviorHandler) Submit(c *gin.Context) {
	var req behaviorSingleRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}
	userID := getUserID(c)
	async := h.cfg.BehaviorWriteAsync
	err := h.svc.Submit(userID, async, service.BehaviorSubmit{
		ActivityID:   req.ActivityID,
		BehaviorType: req.BehaviorType,
		Detail:       req.Detail,
	})
	if err != nil {
		switch err {
		case service.ErrInvalidBehaviorType:
			response.BadRequest(c, "behavior_type 无效，允许: VIEW, COLLECT, SHARE, CLICK, SEARCH")
		default:
			response.BadRequest(c, err.Error())
		}
		return
	}
	response.Success(c, gin.H{"accepted": true})
}

// behaviorBatchRequest is the JSON body for POST /behaviors/batch.
type behaviorBatchRequest struct {
	Behaviors []behaviorSingleRequest `json:"behaviors" binding:"required,dive"`
}

// SubmitBatch handles POST /api/v1/behaviors/batch.
func (h *BehaviorHandler) SubmitBatch(c *gin.Context) {
	var req behaviorBatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		response.BadRequest(c, "请求参数错误: "+err.Error())
		return
	}
	items := make([]service.BehaviorSubmit, 0, len(req.Behaviors))
	for _, it := range req.Behaviors {
		items = append(items, service.BehaviorSubmit{
			ActivityID:   it.ActivityID,
			BehaviorType: it.BehaviorType,
			Detail:       it.Detail,
		})
	}
	userID := getUserID(c)
	async := h.cfg.BehaviorWriteAsync
	err := h.svc.SubmitBatch(userID, async, items)
	if err != nil {
		switch err {
		case service.ErrInvalidBehaviorType:
			response.BadRequest(c, "behavior_type 无效，允许: VIEW, COLLECT, SHARE, CLICK, SEARCH")
		case service.ErrBehaviorBatchEmpty:
			response.BadRequest(c, "behaviors 不能为空")
		case service.ErrBehaviorBatchTooBig:
			response.BadRequest(c, "单次批量最多 100 条")
		default:
			response.BadRequest(c, err.Error())
		}
		return
	}
	response.Success(c, gin.H{"accepted": true, "count": len(items)})
}
