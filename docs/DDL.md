# UAAD 数据库 DDL 汇总

**适用阶段：** Alpha → Beta → v1.0
**数据库：** MySQL 8.0 (开发环境 SQLite 兼容相同结构)
**更新日期：** 2026-04-01

---

## 表清单

| # | 表名 | 用途 | 预计量级 |
|---|---|---|---|
| 1 | `users` | 用户身份 | 千万级 |
| 2 | `activities` | 活动主表 | 10万+ |
| 3 | `enrollments` | 报名记录 | 亿级 |
| 4 | `orders` | 订单表 | 亿级 |
| 5 | `user_behaviors` | 用户行为流水 | 十亿级 |
| 6 | `activity_scores` | 活动热度评分 | 10万+ (每活动一行) |
| 7 | `notifications` | 站内通知 | 亿级 |

> ⚠️ `user_behaviors` 写入量最大（每次浏览都记），生产环境建议按月分表或接入 ClickHouse。

---

## 1. users（用户表）

```sql
CREATE TABLE `users` (
  `id`             BIGINT       NOT NULL AUTO_INCREMENT,
  `phone`          VARCHAR(20)  NOT NULL,
  `username`       VARCHAR(50)  NOT NULL,
  `password_hash`  VARCHAR(255) NOT NULL,
  `role`           ENUM('USER','MERCHANT','SYS_ADMIN') NOT NULL DEFAULT 'USER',
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`     DATETIME     DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_phone` (`phone`),
  KEY `idx_role` (`role`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

**关键约束：**
- `phone` 为唯一身份标识（替代原学生 ID）
- `role` 控制 C 端/商户/管理员权限
- 软删除 (`deleted_at`)，不物理删除

---

## 2. activities（活动表）

```sql
CREATE TABLE `activities` (
  `id`             BIGINT        NOT NULL AUTO_INCREMENT,
  `title`          VARCHAR(200)  NOT NULL,
  `description`    TEXT          NOT NULL,
  `cover_url`      VARCHAR(500)  DEFAULT NULL,
  `location`       VARCHAR(200)  NOT NULL,
  `latitude`       DECIMAL(10,7) DEFAULT NULL,
  `longitude`      DECIMAL(10,7) DEFAULT NULL,
  `category`       ENUM('CONCERT','CONFERENCE','EXPO','ESPORTS','EXHIBITION','OTHER') NOT NULL DEFAULT 'OTHER',
  `tags`           JSON          DEFAULT NULL,
  `max_capacity`   INT           NOT NULL DEFAULT 0,
  `enroll_open_at` DATETIME      NOT NULL,
  `enroll_close_at` DATETIME     NOT NULL,
  `activity_at`    DATETIME      NOT NULL,
  `price`          DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `status`         ENUM('DRAFT','PREHEAT','PUBLISHED','SELLING_OUT','SOLD_OUT','OFFLINE','CANCELLED') NOT NULL DEFAULT 'DRAFT',
  `created_by`     BIGINT        NOT NULL,
  `view_count`     BIGINT        NOT NULL DEFAULT 0,
  `enroll_count`   BIGINT        NOT NULL DEFAULT 0,
  `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`     DATETIME      DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_status` (`status`),
  KEY `idx_category` (`category`),
  KEY `idx_enroll_open` (`enroll_open_at`),
  KEY `idx_created_by` (`created_by`),
  KEY `idx_deleted_at` (`deleted_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

**库存字段说明：**
- `max_capacity` 是物理上限（创建后不可改）
- 实时可抢库存存在 **Redis**（`activity:{id}:stock`），DB 的 `enroll_count` 只作审计
- 查询列表用 Redis 库存，落盘后才递增 `enroll_count`

---

## 3. enrollments（报名表）

```sql
CREATE TABLE `enrollments` (
  `id`             BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`        BIGINT       NOT NULL,
  `activity_id`    BIGINT       NOT NULL,
  `status`         ENUM('QUEUING','SUCCESS','FAILED','CANCELLED') NOT NULL DEFAULT 'QUEUING',
  `queue_position` INT          DEFAULT NULL,
  `enrolled_at`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `finalized_at`   DATETIME     DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_user_activity` (`user_id`, `activity_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_activity_id` (`activity_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

**核心约束：**
- `UNIQUE (user_id, activity_id)` = 幂等保证（同一用户对同一活动只能有一条记录）
- Worker 插入冲突时，直接触发冲正逻辑
- `queue_position` 由 Redis 分配，用于前端展示排队进度

---

## 4. orders（订单表）

```sql
CREATE TABLE `orders` (
  `id`             BIGINT        NOT NULL AUTO_INCREMENT,
  `order_no`       VARCHAR(32)   NOT NULL,
  `enrollment_id`  BIGINT        NOT NULL,
  `user_id`        BIGINT        NOT NULL,
  `activity_id`    BIGINT        NOT NULL,
  `amount`         DECIMAL(10,2) NOT NULL,
  `status`         ENUM('PENDING','PAID','CLOSED','REFUNDED') NOT NULL DEFAULT 'PENDING',
  `paid_at`        DATETIME      DEFAULT NULL,
  `expired_at`     DATETIME      NOT NULL,
  `created_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_order_no` (`order_no`),
  UNIQUE KEY `uk_enrollment_id` (`enrollment_id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_activity_id` (`activity_id`),
  KEY `idx_status_expired` (`status`, `expired_at`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

**关键逻辑：**
- `order_no` 格式：`ORD{YYYYMMDD}{8位序列号}`
- `expired_at` = `created_at + 15分钟`
- 过期扫描 Worker：每 5 分钟扫 `status='PENDING' AND expired_at < NOW()` → 关闭订单 + Redis 补库存
- 模拟支付（Layer 2 阶段）：`POST /orders/:id/pay` 直接变 `PAID`

---

## 5. user_behaviors（用户行为流水表）

```sql
CREATE TABLE `user_behaviors` (
  `id`             BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`        BIGINT       NOT NULL,
  `activity_id`    BIGINT       NOT NULL,
  `behavior_type`  ENUM('VIEW','COLLECT','SHARE','CLICK','SEARCH') NOT NULL,
  `detail`         JSON         DEFAULT NULL,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_activity_type` (`user_id`, `activity_id`, `behavior_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

**写入策略：**
- 前端埋点 → 批量发送（每 60s 或 10 条）
- 写入异步化：不阻塞主流程，Kafka / 内存队列 → 批量 INSERT
- `detail` 扩展字段：`{duration_seconds: 45, source: "home_feed"}`

**生产警告：** 写入量最大，建议按月分表或迁移 ClickHouse。

---

## 6. activity_scores（活动热度评分表）

```sql
CREATE TABLE `activity_scores` (
  `id`               BIGINT    NOT NULL AUTO_INCREMENT,
  `activity_id`      BIGINT    NOT NULL,
  `score`            FLOAT     NOT NULL DEFAULT 0.0,
  `score_components` JSON      NOT NULL,
  `calculated_at`    DATETIME  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `rank`             INT       NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_activity_id` (`activity_id`),
  KEY `idx_score` (`score` DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

**更新频率：**
- 离线全量计算：每 30 分钟
- 近实时更新：有新 enroll 时触发单活动分数增量

---

## 7. notifications（站内通知表）

```sql
CREATE TABLE `notifications` (
  `id`             BIGINT       NOT NULL AUTO_INCREMENT,
  `user_id`        BIGINT       NOT NULL,
  `title`          VARCHAR(200) NOT NULL,
  `content`        TEXT         NOT NULL,
  `type`           ENUM('ENROLL_SUCCESS','ENROLL_FAIL','ORDER_EXPIRE','ACTIVITY_REMINDER') NOT NULL,
  `related_id`     BIGINT       DEFAULT NULL,
  `is_read`        TINYINT(1)   NOT NULL DEFAULT 0,
  `created_at`     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_user_id_read` (`user_id`, `is_read`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
```

---

## Redis 键位约定（逻辑表）

| 键 | 类型 | 用途 | TTL |
|---|---|---|---|
| `activity:{id}:stock` | STRING (INT) | 实时可抢库存 | 7 天 |
| `activity:{id}:enrolled_set` | SET | 已报名 user_id 集合（去重） | 7 天 |
| `activity:{id}:warmup` | STRING | 预热完成标记 | 永不过期 |
| `activity:{id}:sold` | STRING (INT) | 已售数量辅助监控 | 7 天 |
| `activity:global:queue_counter` | STRING (INT) | 全局排队序号 | 每日重置 |
| `activity:queue` | HASH | 排队详细信息 | 活动结束后删除 |
| `rate:ip:{ip}` | 内存 map | IP 级限流计数器 | N/A (内存管理) |
| `rate:user:{user_id}:{activity_id}` | STRING | 用户报名频控 | 1 小时 |
| `recommend:{user_id}` | STRING | 推荐结果缓存 | 5 分钟 |

---

## GORM 模型对齐清单

Alpha 阶段 GORM AutoMigrate 需补全的模型：

```go
// 已有
domain.User ✅

// 需要新增到 main.go AutoMigrate 中
domain.Activity        ❌
domain.Enrollment      ❌
domain.Order           ❌
domain.UserBehavior    ❌
domain.ActivityScore   ❌
domain.Notification    ❌
```

每个模型新增后，在 `migrations/` 目录同步编写 `00X_<name>.up.sql` 和 `.down.sql`。
