# 管理员操作流程 · 批次链路详解

---

## 一、全局视角：batch_id 的一生

`batch_id` 是整个综测系统的"身份证号"，从管理员创建批次开始，贯穿审核链的每一个环节。

```
管理员创建批次
  → batch_id 诞生
    → 学生进入批次：生成综测表 (assessment_forms)
      → 学生提交：状态进入审核链
        → 评价小组审核 → 辅导员审核 → 学工处终审
          → 结果发布 → 异议申诉 → 复评
            → 批次关闭/归档
```

**所有操作都通过 `batch_id` 隔离**：2024-2025 第一学期的数据和第二学期完全独立，不会串。

---

## 二、管理员能做什么

| 功能 | 路由 | 说明 |
|------|------|------|
| 批次管理 | `/module3/batch-manage` | 创建/修改/关闭/删除批次、配置跨班互评 |
| 系统设置 | `/module3/batch-manage/settings` | 等级分数线、提交截止时间、注册开关 |
| 组织管理 | `/module3/org-manage` | 学院/专业/班级的增删 |
| 账号管理 | `/module3/account-manage` | 手动创建/批量导入/批量生成/重置密码 |
| 统计查看 | `/module3/teacher/progress` | 各批次综测进度和明细 |
| 导出报表 | `/module3/teacher/records` | CSV 导出 |
| 操作日志 | — | 查看所有操作记录 |

---

## 三、Step by Step 详解

### Step 1：管理员创建批次

**函数**：`service.createBatch`

管理员在前端 BatchManage 页面填写表单 → `POST /api/module3/batches`：

```
输入：
  school_year: "2024-2025"
  title: "2024-2025学年综合测评"
  college: "计算机学院"
  grade: "大三"
  start_time / end_time
  options: {
    requireCounselorReview: true,       // 是否需要辅导员审核
    requireStudentAffairsReview: true,  // 是否需要学工处审核
    objectionDays: 7,                   // 异议期限（天）
    allowStudentEdit: true,             // 是否允许学生自行编辑
    ...
  }

后端校验：
  - college + grade + school_year 不能重复
  - 学年不能早于当前学年

INSERT INTO assessment_batches (..., status='published')
  → 返回 batch_id（MySQL 自增主键）
```

### Step 2：辅导员配置评价小组和跨班互评

**注意**：这一步是**辅导员**做的，但管理员创建批次时必须知道这个流程的存在——否则批次建好了也没人能审核。

```
辅导员在 CounselorConsole → members 视图：
  1. 选择已发布的批次 (selectedBatchId)
  2. 从管辖学生列表中勾选学生
  3. 点击"赋予身份"
    → POST /api/module3/students/:id/member { enabled: true, batch_id }
    → INSERT INTO assessment_batch_members (batch_id, student_id)

辅导员在 CounselorConsole → assignments 视图：
  1. 选择批次
  2. 配置互评关系：A班(被评) ← B班(评价)
    → PUT /api/module3/batches/:id { review_assignments: [...] }
    → 写入 assessment_review_assignments (batch_id, target_class_id, reviewer_class_id)
```

**跨班互评的核心表**：

```
assessment_review_assignments
  batch_id → 属于哪个批次
  target_class_id → 被评班级（哪个班的学生需要被审核）
  reviewer_class_id → 评价班级（哪个班的学生来审核）
```

### Step 3：学生进入批次

学生打开信息管理页 → `ensureStudentExampleForm(studentId, batchId)`：

```
校验: 学生的 college + grade 必须匹配批次的 college + grade

已有表单？→ 直接返回
没有表单？→ INSERT INTO assessment_forms (batch_id, student_id, is_demo=1, ...)
          → INSERT 示例 assessment_form_items
```

**每个学生 + 每个批次 = 一条 assessment_forms 记录**。

### Step 4：学生提交审核

学生在智能填表页编辑 F1/F2/F3 → 点"提交审核"：

```
POST /api/module1/smart-result/submit { batch_id }
  → service.submitSmartResult(studentId, { batch_id })

  1. 查表单: WHERE student_id=? AND batch_id=?
  2. 校验批次配置: getBatchById(form.batch_id)
  3. 选评价人: selectReviewer(conn, form)
     └─ 通过 batch_id + class_id 查 assessment_review_assignments
        找到谁负责审这个班的学生
     └─ 在评价班级中找工作量最少的评价小组成员
     └─ 工作负载均衡：按已有任务数 ASC 排序，取最少那个

  4. 创建任务: INSERT INTO assessment_review_tasks (batch_id, form_id, reviewer_id)
  5. 更新状态: UPDATE assessment_forms SET status='pending_class_committee'
```

**batch_id 在这步的关键作用**：它决定了评价人的选择范围——每个批次的跨班互评配置不同，同一学生在不同批次可能由不同班级的人审。

### Step 5：审核链推进

评价小组审核通过后，系统按批次配置决定下一步：

```
reviewForm(formId, reviewer, { action: 'approve' })
  → getBatchById(form.batch_id)   ← 读批次配置
  → nextStatusAfter("assessment_member", "approve", options)
      │
      ├─ requireCounselorReview=true  → pending_counselor
      │   └─ assignWorkflowTask → 选辅导员 → 创建 task(stage='counselor')
      │
      ├─ requireStudentAffairsReview=true → pending_student_affairs
      │
      └─ 都不需要 → approved
```

**每一级审核都会查 `form.batch_id`**——不同批次可能有不同的审核链配置（比如有些批次不需要辅导员审核）。

### Step 6：结果发布与异议

审核通过 → `result_released_at = NOW()` → 学生可查看成绩。

**异议期限**由批次的 `options.objectionDays` 决定：

```
截止日期 = result_released_at + objectionDays 天

学生在截止前可提异议：
  → 找到原评价人（通过 assessment_review_tasks WHERE form_id + stage='initial'）
  → 创建新的 task (stage='objection')
  → 状态: approved → pending_objection_review
  → 原评价人复评 → 恢复 approved
```

### Step 7：管理员关闭/归档批次

```
PUT /api/module3/batches/:id/status { status: 'closed' }
  → updateBatchStatus(id, 'closed', operator)
    → updateBatch(id, { status: 'closed' })
    → expireBatchMembershipsIfComplete:
        所有评价小组成员的权限被回收
        UPDATE assessment_batch_members SET status='inactive' WHERE batch_id=?
```

---

## 四、batch_id 全链路总结

```
                     ┌─────────────────┐
                     │ 管理员创建批次    │
                     │ INSERT batch     │
                     │ → batch_id = 1   │
                     └────────┬────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
    ┌──────────────┐  ┌────────────┐  ┌──────────────┐
    │ 辅导员配置    │  │ 辅导员指定  │  │ 管理员配      │
    │ 跨班互评      │  │ 评价小组成员 │  │ 系统设置      │
    │ (assignments)│  │ (members)   │  │ (settings)   │
    │ batch_id=1   │  │ batch_id=1  │  │ 全局配置      │
    └──────┬───────┘  └──────┬─────┘  └──────────────┘
           │                │
           └───────┬────────┘
                   │
                   ▼
         ┌──────────────────┐
         │ 学生进入批次       │
         │ ensureExampleForm │
         │ → form.batch_id=1 │
         └────────┬─────────┘
                  │
                  ▼
         ┌──────────────────┐
         │ 学生提交审核       │
         │ submitSmartResult │
         │ → 查 batch 配置    │
         │ → 选评价人          │
         │ → 创建 task        │
         │ task.batch_id=1   │
         │ status=pend_cc    │
         └────────┬─────────┘
                  │
    ┌─────────────┼─────────────┐
    ▼             ▼             ▼
  评价小组     辅导员       学工处
  审核         审核          审核
 (查batch    (查batch     (查batch
  配置决定    配置决定      配置决定
  下一级)     下一级)       下一级)
    │             │             │
    └─────────────┼─────────────┘
                  │
                  ▼
         ┌──────────────────┐
         │ approved          │
         │ 结果发布           │
         │ → 学生可提异议     │
         │ (objectionDays内) │
         └────────┬─────────┘
                  │
                  ▼
         ┌──────────────────┐
         │ 管理员关闭/归档    │
         │ expire members   │
         │ WHERE batch_id=1 │
         └──────────────────┘
```

---

## 五、涉及的所有表

| 表 | batch_id 来源 | 写入时机 |
|----|-------------|---------|
| `assessment_batches` | 自增主键 | 管理员创建批次 |
| `assessment_forms` | INSERT 时写入 | 学生进入批次/生成示例表单 |
| `assessment_form_items` | 通过 form_id 间接关联 | 表单生成时批量写入 |
| `assessment_review_assignments` | INSERT 时写入 | 辅导员配置跨班互评 |
| `assessment_batch_members` | INSERT 时写入 | 辅导员指定评价小组成员 |
| `assessment_review_tasks` | INSERT 时写入 | 每次创建审核任务 |
| `assessment_review_records` | 通过 form_id 间接关联 | 每次审核操作 |
| `assessment_item_reviews` | 通过 form_id 间接关联 | 每条加分项的审核决定 |
| `assessment_objections` | INSERT 时写入 | 学生提出异议 |
| `assessment_operation_logs` | detail 字段描述 | 所有管理员操作 |
| `evaluation_results` | INSERT / UPDATE 时写入 | 智能填表提交后同步 |
| `smart_fill_data` | INSERT / UPDATE 时写入 | 智能填表缓存 |
| `scoring_rules` | INSERT 时写入 | 规则解析时通过 rule_set 间接关联 |
| `rule_sources` | INSERT 时写入 | 上传规则文件时 |
| `rule_sets` | INSERT 时写入 | 规则解析时 |

---

## 六、关键设计决策

1. **batch_id 下沉到最底层**：`scoring_rules`、`assessment_review_tasks` 这些表都直接存 `batch_id`，查询时不需要 JOIN 多层
2. **跨班互评防作弊**：评价人和被评人不属于同一个班级，由辅导员配置，系统自动负载均衡分配任务
3. **审核链可配置**：每个批次可以独立决定是否需要辅导员审核、是否需要学工处审核
4. **异议机制**：结果发布后允许学生在截止日期内申诉，由原评价人复评而非辅导员，保证公正
5. **批次关闭后清理权限**：关闭或归档批次时自动收回所有评价小组成员在该批次下的权限
