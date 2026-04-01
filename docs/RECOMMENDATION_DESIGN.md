# UAAD 推荐系统选型方案

**阶段：** Layer 3 (v1.0)
**更新日期：** 2026-04-01

---

## 1. 推荐策略总览

UAAD 的推荐系统分为**三个层次**，渐进式演进：

| 层级 | 策略 | 所需数据量 | 适用阶段 | 实现复杂度 |
|---|---|---|---|---|
| L1 | **热度排序 (Hot Ranking)** | 活动浏览数 + 报名数 | Alpha → Beta | ⭐ 低 |
| L2 | **多维度加权热度评分** | 行为数据 + 时间衰减 | Beta → v1.0 | ⭐⭐ 中 |
| L3 | **Item-based 协同过滤 (CBF)** | `user_behavior` 表 ≥ 100 条/用户 | v1.0+ | ⭐⭐⭐ 中高 |

---

## 2. L1: 热度排序（最简易版）

### 算法

```
按 enroll_count DESC 排序，辅以 view_count 作为 tiebreaker
```

```sql
SELECT id, title, enroll_count, view_count
FROM activities
WHERE status = 'PUBLISHED'
ORDER BY enroll_count DESC, view_count DESC
LIMIT 20;
```

### 应用场景
- 用户刚注册、无行为数据时的**冷启动兜底**
- 活动广场的 "热门" 排序
- 推荐列表未登录用户的默认输出

### 为什么从 L1 开始？
- **零成本**：不需要额外数据结构，直接用已有的 `enroll_count` 和 `view_count`
- **效果好**：对于活动类平台，马太效应极强——热门活动永远是最多人想看到的
- **快速验证**：Beta 阶段就能用，不需要等行为数据积累

---

## 3. L2: 多维度加权热度评分（推荐核心 🔑）

### 评分公式

```
score = (w_v × view_score) + (w_e × enroll_score) + (w_s × speed_score) - (w_t × time_decay)

其中各分量：
  view_score  = log(1 + view_count)                 # 浏览数对数化（防长尾效应）
  enroll_score = enroll_count / max_capacity          # 报名率 (0.0 ~ 1.0)
  speed_score  = enroll_count / elapsed_hours         # 单位时间报名速度（反映活动热度增速）
  time_decay   = max(0, 1 - (now - created_at) / ttl_hours)  # 时间衰减

权重配置（可通过 config.json 调整）：
  w_v = 0.20   # 浏览权重
  w_e = 0.35   # 报名权重（最重要）
  w_s = 0.25   # 增速权重
  w_t = 0.20   # 时间衰减权重
```

### 计算频率

| 类型 | 频率 | 范围 | 触发方式 |
|---|---|---|---|
| **离线全量** | 每 30 分钟 | 所有 PUBLISHED 活动 | Cron 定时任务 |
| **近实时增量** | 事件触发 | 单个活动 (该活动有新 enroll 时) | Enrollment Worker 触发 |

### 离线全量计算（Go 实现）

```go
// recommendation_service.go
func (s *RecommendationService) RecalculateAllScores(ctx context.Context) error {
    var activities []domain.Activity
    s.db.Where("status = ?", "PUBLISHED").Find(&activities)
    
    cfg := s.config.ScoringWeights // 从配置读取
    
    for _, a := range activities {
        viewScore := math.Log(1 + float64(a.ViewCount))
        enrollRatio := float64(a.EnrollCount) / float64(a.MaxCapacity)
        elapsedHours := time.Since(a.CreatedAt).Hours()
        speedScore := float64(a.EnrollCount) / math.Max(elapsedHours, 1)
        
        ttlHours := 720.0 // 30 天全生命周期
        timeDecay := math.Max(0, 1 - time.Since(a.CreatedAt).Hours()/ttlHours)
        
        score := cfg.ViewWeight*viewScore +
                 cfg.EnrollWeight*enrollRatio +
                 cfg.SpeedWeight*speedScore -
                 cfg.TimeDecayWeight*timeDecay
        
        // 写入/更新 activity_scores 表
        s.db.Where("activity_id = ?", a.ID).
            Assign(map[string]interface{}{
                "score": score,
                "score_components": map[string]float64{
                    "view_weight":  cfg.ViewWeight * viewScore,
                    "enroll_weight": cfg.EnrollWeight * enrollRatio,
                    "speed_weight": cfg.SpeedWeight * speedScore,
                    "time_decay":   cfg.TimeDecayWeight * timeDecay,
                },
                "calculated_at": time.Now(),
            }).
            FirstOrCreate(&domain.ActivityScore{ActivityID: a.ID})
    }
    
    // 更新排名
    s.updateRanks()
    return nil
}
```

### 查询推荐列表

```sql
-- 推荐首页：按 score DESC 取 Top-20
SELECT a.id, a.title, a.cover_url, a.category, a.location,
       a.price, a.enroll_open_at, s.score, s.rank
FROM activity_scores s
JOIN activities a ON a.id = s.activity_id
WHERE a.status = 'PUBLISHED'
  AND a.deleted_at IS NULL
ORDER BY s.score DESC
LIMIT 20;
```

### 优势
- **可解释性强**：每个活动的分数组成部分清晰可见（可显示给用户 "为什么推荐"）
- **实时性好**：增量更新确保热门活动刚上架就排在前面
- **实现成本低**：纯 Go + SQL，不需要引入 Python 或 ML 框架

---

## 4. L3: Item-based 协同过滤（个性化推荐）

### 核心思想

> "喜欢活动 A 的用户，也喜欢活动 B"

通过分析用户行为矩阵，计算活动之间的相似度，为目标用户推荐与其已交互活动相似的活动。

### 数据源：user-activity 交互矩阵

```
从 user_behaviors 表构建矩阵：

         活动A   活动B   活动C   活动D
用户1:    5      3      0      1
用户2:    0      2      4      0
用户3:    3      1      2      3
用户4:    1      0      0      5

权重映射:
  VIEW=1,  COLLECT=5,  SHARE=8,  SEARCH=2
```

### 活动相似度计算（Cosine Similarity）

```python
# 伪代码（推荐模块核心计算）
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity

# 1. 构建 user-activity 矩阵 (用户 × 活动)
matrix = build_user_activity_matrix(behaviors)

# 2. 计算活动之间的相似度 (活动 × 活动)
similarity = cosine_similarity(matrix.T)

# 3. 为目标用户推荐
def recommend(user_id, similarity, matrix, top_k=20):
    user_vector = matrix[user_id]
    # 只推荐用户未交互过的活动
    uninteracted = np.where(user_vector == 0)[0]
    
    # 用户交互过的活动 × 与未交互活动的相似度 → 加权分
    scores = user_vector @ similarity[:, uninteracted]
    
    # 取 Top-K
    return uninteracted[np.argsort(-scores)[:top_k]]
```

### Go 中的简化实现（不引入 Python 服务）

```go
// recommendation_repository.go
func (r *RecommendationRepository) GetSimilarActivities(activityID uint64, limit int) ([]uint64, error) {
    // 核心 SQL：找出与活动 A 有共同交互用户的活动
    // "喜欢 A 的人也喜欢 B"
    query := `
        SELECT b.activity_id,
               COUNT(DISTINCT a.user_id) as common_users
        FROM user_behaviors a
        JOIN user_behaviors b ON a.user_id = b.user_id
            AND a.activity_id = ? 
            AND b.activity_id != a.activity_id
            AND b.behavior_type IN ('VIEW', 'COLLECT')
        WHERE a.behavior_type IN ('VIEW', 'COLLECT')
        GROUP BY b.activity_id
        ORDER BY common_users DESC
        LIMIT ?
    `
    // 返回相似活动 ID 列表
}

// 为用户生成推荐
func (s *RecommendationService) RecommendForUser(userID uint64, limit int) ([]ActivityBrief, error) {
    // 1. 获取用户已交互的活动
    interacted := s.repo.GetUserActivities(userID)
    
    // 2. 对每个已交互活动，查找相似活动
    var candidates []ActivityScore
    for _, act := range interacted {
        similar, _ := s.repo.GetSimilarActivities(act.ID, limit*3)
        candidates = append(candidates, similar...)
    }
    
    // 3. 加权合并 (收藏的活动的相似项权重更高)
    // 4. 去重（排除已报名/已收藏的活动）
    // 5. 混合热度评分（新活动给新鲜度加成）
    // 6. 返回 Top-K
}
```

### 为什么不选其他算法？

| 算法 | 为什么不选 |
|---|---|
| **矩阵分解 (SVD/ALS)** | 需要更多数据量（每活动 ≥ 50 次交互），对课程项目过重 |
| **深度学习推荐模型 (NMF/DeepFM)** | 需要专门的 Python 服务 + GPU，部署复杂度高 |
| **内容推荐 (CBF by tags/category)** | 可作为补充因子，但单独使用效果差（标签质量依赖录入标准） |
| **User-based CF** | 用户矩阵远大于活动矩阵（用户 >> 活动），内存消耗更大 |

**Item-based CF 是最优平衡：**
- 活动数量远少于用户数量（10万 vs 千万），相似度矩阵可加载到内存
- 实现简单（SQL JOIN 即可完成核心逻辑，无需 ML 框架）
- 效果直观可解释（"因为你收藏了 A…"）

### 计算与更新频率

| 操作 | 频率 | 说明 |
|---|---|---|
| 矩阵重建 | 每 6 小时 | 从 `user_behaviors` 增量构建全量矩阵 |
| 相似度矩阵 | 每 6 小时 | 离线计算全量活动相似度 |
| 用户推荐缓存 | 每 5 分钟 | 从缓存的推荐结果中取（Redis） |

---

## 5. 混合推荐策略（最终方案）

```
GET /recommendations (用户已登录)
    │
    ├── (1) 热度评分推荐 (权重 40%)
    │   └── Top-10 按 score DESC
    │
    ├── (2) 协同过滤推荐 (权重 40%)
    │   └── 基于用户行为 Top-10 相似活动
    │
    └── (3) 新鲜度推荐 (权重 20%)
        └── 最近 48h 内上架的活动，按 enroll_rate 排序
            │
            ▼
    [合并、去重、去除已报名活动]
            │
            ▼
    Top-20 返回前端，附带 recommend_reason:
    "基于您收藏的「深度学习实战」推荐"
    "热门活动"
    "新上架"
```

**缓存策略：**
```
Redis: SETEX recommend:{user_id} 300 {JSON}  // 5 分钟过期

前端传 need_refresh=true → 绕过缓存重新计算

用户行为变化 → 自动使该用户推荐缓存失效
```

---

## 6. 推荐系统架构图

```
┌─────────────────────────────────────────────────────────┐
│                    前端展示层                              │
│  ┌─────────┐  ┌──────────┐  ┌────────────────────────┐  │
│  │ "为你推荐"│  │  "热门榜单" │  │  "新发现" (新鲜度推荐)   │  │
│  │ (个性化) │  │ (热度排序) │  │                        │  │
│  └────┬────┘  └────┬─────┘  └───────────┬────────────┘  │
│       └────────────┴─────────────────────┘               │
│                         │                                │
├─────────────────────────|────────────────────────────────┤
│                    API 层                                 │
│  GET /recommendations          GET /recommendations/hot  │
│  (个性化 → CF + Hot hybrid)    (纯热度排序)                │
├─────────────────────────|────────────────────────────────┤
│                    推荐计算层                               │
│  ┌─────────────────────┐  ┌──────────────────────────┐  │
│  │ Heat Scoring Engine │  │ Collaborative Filtering   │  │
│  │ (Go, 30min cron)    │  │ (Go, 6h batch)            │  │
│  │ → activity_scores   │  │ → similarity lookup       │  │
│  └─────────────────────┘  └──────────────────────────┘  │
├─────────────────────────|────────────────────────────────┤
│                    数据层                                  │
│  ┌──────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │ MySQL    │  │ user_behavior│  │  Redis Cache        │  │
│  │ activity │  │  表 (行为数据)│  │  recommend:{uid}   │  │
│  │ _scores  │  │  (十亿级)     │  │  TTL=5min           │  │
│  └──────────┘  └──────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## 7. 埋点采集方案

### 前端行为埋点

```typescript
// hooks/useBehaviorTracker.ts
class BehaviorTracker {
    private queue: BehaviorEvent[] = [];

    track(type: BehaviorType, activityId: number, detail?: Record<string, any>) {
        this.queue.push({
            activity_id: activityId,
            behavior_type: type,
            detail: detail || {},
            timestamp: Date.now(),
        });

        // 积攒到 10 条或 60 秒，批量发送
        if (this.queue.length >= 10) {
            this.flush();
        }
    }

    async flush() {
        if (this.queue.length === 0) return;
        const batch = this.queue.splice(0, this.queue.length);
        await api.post('/behaviors/batch', { behaviors: batch });
    }
}

// 页面中使用
const tracker = useBehaviorTracker();

// 活动详情页
useEffect(() => {
    tracker.track('VIEW', activity.id, { source: 'home_feed', duration: viewTime });
}, [activity.id]);

const handleCollect = () => {
    tracker.track('COLLECT', activity.id);
    // ...收藏逻辑
};
```

### 后端接收

```go
// handler/behavior_handler.go
func (h *BehaviorHandler) BatchCreate(c *gin.Context) {
    var req struct {
        Behaviors []struct {
            ActivityID   uint64            `json:"activity_id" binding:"required"`
            BehaviorType string            `json:"behavior_type" binding:"required"`
            Detail       json.RawMessage   `json:"detail"`
            Timestamp    int64             `json:"timestamp"`
        } `json:"behaviors" binding:"required,dive"`
    }
    
    // 解析并写入 DB (异步，不阻塞返回)
    go h.svc.ProcessBatch(userID, req.Behaviors)
    
    response.Success(c, nil) // 立即返回，不等待写入完成
}
```

---

## 8. 冷启动策略

新用户（无行为数据）怎么推荐？

```
if 用户无行为数据:
    返回 热度排名 Top-20 + 新上架 Top-5 混合
    strategy = "hot_ranking" (API 响应中标识)

if 用户有少量行为 (1~20 条):
    返回 协同过滤(有限) + 热度加权
    strategy = "cold_fill"

if 用户有足够行为 (>20 条):
    返回 混合推荐 (CF 40% + Hot 40% + Fresh 20%)
    strategy = "collaborative_filtering"
```

---

## 9. 阶段里程碑

| 阶段 | 策略 | 何时交付 |
|---|---|---|
| Alpha | 纯热度排序 (enroll_count DESC) | Sprint 2 (活动模块上线时) |
| Beta | 多维度加权热度评分 | Sprint 4 前半 (L2) |
| v1.0 | 热力 + 协同过滤混合推荐 | Sprint 4 后半 (L3) |

### 当前推荐选型结论

**v1.0 最终方案 = Go 原生实现的多维度加权 + SQL-Item-based CF**

不做独立的 Python ML 服务，原因：
1. 活动数量 ≤ 10万，SQL JOIN + 内存计算完全够用
2. 维护成本高：多一个服务 = 多一个运维复杂度
3. v2.0+ 如果数据量突破百万活动，再迁移独立 ML 服务
4. 现阶段 **数据积累 > 算法复杂度**
