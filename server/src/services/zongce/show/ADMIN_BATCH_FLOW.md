# 管理员操作流程 · 批次链路详解

> 最后更新：同步后代码变动，以当前实际代码为准

---

## 一、角色与权限矩阵

管理员在批次管理中的独有权限：

| 操作 | admin | counselor | student_affairs | student |
|------|:-----:|:---------:|:---------------:|:-------:|
| 创建批次 | ✅ | ❌ | ❌ | ❌ |
| 修改批次（全字段） | ✅ | ❌ | ❌ | ❌ |
| 修改批次（仅互评配置） | ✅ | ✅ | ❌ | ❌ |
| 修改批次状态 | ✅ | ❌ | ❌ | ❌ |
| 删除批次 | ✅ | ❌ | ❌ | ❌ |
| 查看批次列表 | ✅ | ✅（管辖范围） | ✅（全部） | ✅（自己的学院年级） |

---

## 二、路由定义

```js
POST   /api/module3/batches            → createBatch        (admin only)
GET    /api/module3/batches            → getBatches         (所有已登录)
PUT    /api/module3/batches/:id        → updateBatch        (admin + counselor)
PUT    /api/module3/batches/:id/status → updateBatchStatus  (admin only)
DELETE /api/module3/batches/:id        → deleteBatch        (admin only)
```

`admin only` = `auth` + `roleCheck("admin")`

---

## 三、函数详解

### 3.1 createBatch(data, operator)

**调用链**：前端 BatchManage → `POST /batches` → controller → service

**参数**：

```js
data = {
  school_year: "2024-2025",       // 或从 title 正则提取
  title: "2024-2025学年综测",
  college: "计算机学院",
  grade: "大三",
  description: "...",
  start_time: "2025-03-01 00:00",
  end_time: "2025-07-31 23:59",
  status: "published",             // 默认
  review_assignments: [...],       // 可选，跨班互评配置
}
```

**校验**：
- `college` + `grade` 必填
- 学年不能早于当前学年
- 同一 `college + grade + school_year` 不能有重复的未删除批次

**事务内 SQL**：
```sql
-- 1. 查重
SELECT id FROM assessment_batches
WHERE status <> 'deleted'
  AND school_year = ? AND college = ? AND grade = ?
LIMIT 1

-- 2. 插入
INSERT INTO assessment_batches
  (school_year, title, college, grade, description,
   start_time, end_time, requirements, status, created_by, creator_name, options)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)

-- 3. 插入跨班互评（如果提供了 review_assignments）
INSERT INTO assessment_review_assignments
  (batch_id, target_class_id, target_class_name, reviewer_class_id, reviewer_class_name, created_by)
VALUES (?, ?, ?, ?, ?, ?)
```

**返回值**：`enrichBatch(batch)` 装饰后的对象，含 `target_student_count`、`submitted_count`、`approved_count`、`pending_count`。

---

### 3.2 updateBatch(id, data, operator)

**角色分支**：

| 角色 | 可修改内容 |
|------|-----------|
| **counselor** | 仅 `review_assignments`（跨班互评配置） |
| **admin** | 取决于是否为历史批次 |

**历史批次判断**：
```js
// 学年起始年份 < 当前学年 → 历史批次
const isHistorical = parseSchoolYearStart(current.school_year) < currentAcademicYearStart()
```

- **历史批次**：只能改 `description` 和 `status`，其他字段锁定
- **非历史批次**：所有字段可改

**事务内 SQL**：
```sql
-- 1. 行锁读
SELECT * FROM assessment_batches WHERE id = ? AND status <> 'deleted' FOR UPDATE

-- 2. 更新
UPDATE assessment_batches
SET school_year=?, title=?, college=?, grade=?, description=?,
    start_time=?, end_time=?, requirements=?, status=?, options=?
WHERE id=?

-- 3. 替换互评配置（如果提供了 review_assignments）
--    replaceAssignments 内部：先 DELETE 旧记录，再 INSERT 新记录
DELETE FROM assessment_review_assignments WHERE batch_id=?
INSERT INTO assessment_review_assignments (batch_id, target_class_id, ...) VALUES (...)
```

**返回值**：`enrichBatch()` 装饰后的完整批次对象。

---

### 3.3 updateBatchStatus(id, status, operator)

直接复用 `updateBatch`：

```js
async function updateBatchStatus(id, status, operator) {
  if (operator.role !== "admin") throw new Error("仅管理员可修改批次状态");
  const result = await updateBatch(id, { status }, operator);  // ← 复用

  // 关闭/归档 → 清理评价小组成员权限
  if (["closed", "archived"].includes(String(status))) {
    await expireBatchMembershipsIfComplete(conn, Number(id));
  }
  return result;
}
```

**批次状态流转**：`draft` → `published` → `closed` → `archived`

---

### 3.4 deleteBatch(id, operator)

**软删除**，不物理删除记录：

```sql
-- 1. 行锁读
SELECT * FROM assessment_batches WHERE id = ? AND status <> 'deleted' FOR UPDATE

-- 2. 标记删除
UPDATE assessment_batches SET status = 'deleted' WHERE id = ?

-- 3. 停用该批次所有评价小组成员权限
UPDATE assessment_batch_members
SET status = 'inactive', removed_at = NOW()
WHERE batch_id = ? AND status = 'active'

-- 4. 同步每个成员的全局标志
SELECT student_id FROM assessment_batch_members WHERE batch_id = ?
-- 对每个成员：
SELECT COUNT(*) AS count FROM assessment_batch_members
WHERE student_id = ? AND status = 'active'
-- 如果 count = 0：
UPDATE users SET is_assessment_member = 0 WHERE id = ?
```

---

### 3.5 listBatches(user)

**按角色过滤**：

| 角色 | SQL 过滤 |
|------|---------|
| `admin` / `student_affairs` | 无过滤，看所有未删除批次 |
| `student` | `college = ? AND grade = ?`（学生自己的学院年级） |
| `counselor` | `college = ? AND grade = ?`（管辖范围），无范围则返回空数组 |

```sql
SELECT * FROM assessment_batches WHERE status <> 'deleted'
  [AND college = ? AND grade = ?]   -- student / counselor
ORDER BY COALESCE(start_time, created_at) DESC, id DESC
```

每条记录通过 `enrichBatch()` 附加统计：
```sql
SELECT
  (SELECT COUNT(*) FROM users u WHERE u.role='student' AND u.college=? AND u.grade=?) AS target,
  SUM(CASE WHEN f.status <> 'smart_ready' THEN 1 ELSE 0 END) AS submitted,
  SUM(CASE WHEN f.status = 'approved' THEN 1 ELSE 0 END) AS approved,
  SUM(CASE WHEN f.status IN ('pending_class_committee','pending_counselor',
    'pending_student_affairs','pending_objection_review') THEN 1 ELSE 0 END) AS pending
FROM assessment_forms f WHERE f.batch_id = ?
```

---

## 四、batch_id 全链路

```
[1] 管理员 createBatch
      → INSERT assessment_batches → batch_id = 1
      → INSERT assessment_review_assignments (跨班互评，可选)
      → INSERT assessment_operation_logs

[2] 辅导员 updateBatch(id, { review_assignments }, counselor)
      → (counselor 只能改互评配置)
      → replaceAssignments: DELETE 旧 + INSERT 新

[3] 辅导员 setAssessmentMember(studentId, { enabled: true, batch_id })
      → INSERT assessment_batch_members (batch_id, student_id)
      → UPDATE users SET is_assessment_member = 1

[4] 学生 ensureStudentExampleForm → assessment_forms (batch_id)
    学生 submitSmartResult → assessment_review_tasks (batch_id)
    评价小组 reviewForm → 推进状态
    辅导员 reviewForm → 推进状态
    学工处 reviewForm → approved

[5] 管理员 updateBatchStatus(id, 'closed')
      → UPDATE assessment_batches SET status = 'closed'
      → expireBatchMembershipsIfComplete → 停用成员权限

[6] 管理员 deleteBatch(id)
      → UPDATE assessment_batches SET status = 'deleted'  (软删除)
      → UPDATE assessment_batch_members SET status = 'inactive'  (所有成员)
      → 所有学生 is_assessment_member 置 0
```

---

## 五、数据表清单（批次链路涉及的全部 15 张表）

| 表 | batch_id 来源 | 操作 |
|----|-------------|------|
| `assessment_batches` | 自增主键 | createBatch 写入 |
| `assessment_forms` | INSERT 时写入 | 学生进入批次 |
| `assessment_form_items` | 通过 form_id 间接 | 表单明细 |
| `assessment_review_assignments` | INSERT 时写入 | 跨班互评配置 |
| `assessment_batch_members` | INSERT 时写入 | 评价小组成员 |
| `assessment_review_tasks` | INSERT 时写入 | 审核任务 |
| `assessment_review_records` | 通过 form_id 间接 | 审核操作记录 |
| `assessment_item_reviews` | 通过 form_id 间接 | 逐项审核 |
| `assessment_objections` | INSERT 时写入 | 异议申诉 |
| `assessment_operation_logs` | detail 字段 | 操作日志 |
| `evaluation_results` | INSERT/UPDATE | 评定结果 |
| `smart_fill_data` | INSERT/UPDATE | 智能填表缓存 |
| `scoring_rules` | INSERT 时写入 | 计分规则 |
| `rule_sets` | INSERT 时写入 | 规则集 |
| `rule_sources` | INSERT 时写入 | 规则文件 |
