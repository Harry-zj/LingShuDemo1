# 信息管理（Module3）— 功能说明文档

---

## 一、模块定位

信息管理是整个综测系统的**核心工作流引擎**。智能填表产出的分数和材料在这里进入审核链，经过多级角色审批后生成最终综测成绩。

**四种角色共同协作**：

```
学生 → 评价小组（跨班互评）→ 辅导员 → 学生工作处 → 结果发布
  ↑                                                        │
  └──────────────── 异议申诉 ─────────────────────────────┘
```

---

## 二、角色体系

| 角色 | 标识 | 职责 |
|------|------|------|
| **学生** | `student` | 查看/编辑自己的综测表、提交审核、查看结果、提出异议 |
| **评价小组成员** | `class_committee` | 审核被分配的学生材料（跨班互评）、处理异议复评 |
| **辅导员** | `counselor` | 管辖班级学生的综测、配置跨班互评关系、审核评价结果 |
| **学生工作处** | `student_affairs` | 最终审核、查看统计、导出报表 |
| **管理员** | `admin` | 批次创建、组织架构管理、账号管理、系统设置 |

中间件 `roleCheck.js` 在路由层做权限拦截：`roleCheck('admin', 'counselor')` 表示只有这两种角色能访问。

---

## 三、综测表单结构

每个学生的综测表由三大维度组成：

```
F1 基本素质（权重 10%）
  ├─ A1 思想政治表现    (0-20分)
  ├─ A2 道德品质修养    (0-20分)
  ├─ A3 学习态度作风    (0-20分)
  ├─ A4 组织纪律观念    (0-20分)
  └─ A5 身心健康素质    (0-20分)

F2 课程学习成绩（权重 65%）
  └─ COURSE 各科加权平均分

F3 创新实践（权重 25%）
  ├─ B1 职业技能  ├─ B2 学科竞赛  ├─ B3 科研学术
  ├─ B4 文学宣传  ├─ B5 社会工作  ├─ B6 社会实践
  ├─ B7 文体艺术  └─ B8 劳育

总分 = F1×0.10 + F2×0.65 + F3×0.25
等级 = 优(≥90) / 良(≥80) / 中等(≥70) / 合格(≥60) / 待提升
```

---

## 四、表单状态流转

一条 `assessment_forms` 记录从创建到结束经历的状态：

```
smart_ready            ← 智能填表生成 / 示例表单创建
  │
  ▼ 学生提交
pending_class_committee ← 等待评价小组成员审核
  │         │
  │         └─ returned_by_class_committee ← 退回学生修改
  ▼ 评价小组通过
pending_counselor      ← 等待辅导员审核
  │         │
  │         └─ returned_by_counselor ← 退回学生修改
  ▼ 辅导员通过
pending_student_affairs ← 等待学生工作处审核
  │         │
  │         └─ returned_by_student_affairs ← 退回学生修改
  ▼ 学工处通过
approved                 ← 审核完成，等待结果发布
  │
  ▼ 结果发布 (result_released_at IS NOT NULL)
  │
  ├─ pending_objection_review ← 学生提出异议，评价小组复评
  │                              └→ approved (复评完成)
  └─ (异议截止) → 最终成绩
```

退回（`returned_*`）时学生可以编辑并重新提交；不予认定（`rejected`）直接结束。

---

## 五、数据如何进入 assessment_forms

两条路径：

**路径 1 — 示例表单**：学生打开信息管理页 → `ensureStudentExampleForm` → 如果该学生+批次没有表单，自动创建 `is_demo=1` 的示例数据。这是测试占位，方便开发和演示。

**路径 2 — 智能填表更新**：学生在智能填表页编辑 F1/F2/F3 → 点"保存"或"提交审核" → `updateSmartResult` / `submitSmartResult` → UPDATE 已有表单的 items 和 scores → 状态从 `smart_ready` → `pending_class_committee`。

**注意**：当前代码中，智能填表只能 UPDATE 已有表单，不能 INSERT 新表单。所以学生必须先点进信息管理页一次，让系统生成示例表单。

---

## 六、各角色功能菜单

### 6.1 学生端

| 功能 | 路由 | 说明 |
|------|------|------|
| 个人中心 | `/module3/profile` | 修改基本信息、密码 |
| 综测填表 | `/module3/student/forms` | 选择批次 → 查看/编辑/提交综测表 |
| 查看结果 | `/module3/student/results` | 查看已发布的综测成绩和等级 |
| 异议申诉 | 结果页内 | 在截止日期前可对评分项提出异议 |

### 6.2 评价小组成员

| 功能 | 路由 | 说明 |
|------|------|------|
| 评价任务 | `/module3/class-leader` | 初始评价任务列表 + 异议复评任务列表 |
| 逐项审核 | `/module3/review-detail/:id` | 对每条 F3 加分项做通过/退回操作 |

评价小组的核心机制是**跨班互评**：辅导员配置 A 班学生审核 B 班学生，防止同班互相放水。

### 6.3 辅导员

| 功能 | 路由 | 说明 |
|------|------|------|
| 管辖范围 | `/module3/counselor/scope` | 设置负责的学院/年级/班级 |
| 学生列表 | `/module3/counselor/students` | 查看管辖学生及其综测状态 |
| 评价小组 | `/module3/counselor/members` | 指定学生为评价小组成员 |
| 跨班互评 | `/module3/counselor/assignments` | 配置 A 班→B 班的互评关系 |
| 审核 | 任务面板 | 对评价小组审核后的表做二级审核 |
| 统计 | `/module3/teacher/progress` | 查看各班级综测进度 |

### 6.4 学生工作处

| 功能 | 路由 | 说明 |
|------|------|------|
| 终审 | 任务面板 | 三级审核（最后一道关） |
| 统计 | `/module3/teacher/progress` | 全院综测进度和明细 |
| 导出 | `/module3/teacher/records` | CSV 导出综测结果 |
| 操作日志 | — | 查看系统操作记录 |

### 6.5 管理员

| 功能 | 路由 | 说明 |
|------|------|------|
| 批次管理 | `/module3/batch-manage` | 创建/编辑/发布/删除评估批次 |
| 组织管理 | `/module3/org-manage` | 学院/专业/班级的增删查 |
| 账号管理 | `/module3/account-manage` | 手动创建/批量导入/批量生成/重置密码 |
| 系统设置 | `/module3/settings` | 等级分数线、提交截止时间等 |

---

## 七、批次（Batch）

批次是隔离每次综测评估的核心实体。

**`assessment_batches` 表**：

| 字段 | 说明 |
|------|------|
| `school_year` | 学年（如 2024-2025） |
| `title` | 批次名称 |
| `college` / `grade` | 适用学院和年级 |
| `start_time` / `end_time` | 评估起止时间 |
| `status` | draft → published → archived |
| `created_by` | 创建者（管理员） |
| `options` | JSON 扩展配置（异议天数等） |

一个批次绑定一个学院+年级。学生只能看到自己学院+年级的批次。

---

## 八、跨班互评机制

为了防止同班学生互相放水，系统采用**跨班互评**：

1. 辅导员在 `assessment_review_assignments` 中配置：A 班学生 → 审核 B 班学生
2. 学生在 `assessment_batch_members` 中被指定为评价小组成员
3. 当目标班级的学生提交表单后，系统自动按工作量均分生成 `assessment_review_tasks`
4. 评价小组成员看到被分配的学生列表，逐项审核

`assessment_review_assignment_members` 记录 reviewer ↔ assignment 的映射关系。

---

## 九、异议申诉流程

1. 综测结果发布后，学生在截止日期（`result_released_at + objectionDays`）内可提出异议
2. 每条异议对应一个 `assessment_form_items`，写入 `assessment_objections`
3. 异议由**原评价小组成员**复评（不是辅导员）
4. 复评完成后结果更新

---

## 十、统计与导出

`getStatistics` 按批次统计：
- 各班级已提交/待审核/已通过/退回数量
- 各等级人数分布
- 平均分

`exportCsv` 导出指定批次的完整综测结果 CSV 文件。

---

## 十一、关键数据表一览

| 表 | 说明 |
|----|------|
| `users` | 用户（角色：student/counselor/student_affairs/admin/class_committee） |
| `assessment_batches` | 评估批次 |
| `assessment_forms` | 学生综测表（每学生每批次一条） |
| `assessment_form_items` | 综测表加分项明细（F1/F2/F3 拆分到每条） |
| `assessment_review_tasks` | 评价任务分配 |
| `assessment_review_records` | 审核操作记录 |
| `assessment_item_reviews` | 逐项审核决定 |
| `assessment_objections` | 异议申诉 |
| `assessment_colleges` / `assessment_majors` / `assessment_classes` | 组织架构 |
| `assessment_batch_members` | 评价小组成员 |
| `assessment_review_assignments` | 跨班互评配置 |
| `assessment_review_assignment_members` | 评价者↔互评配置映射 |
| `assessment_settings` | 系统设置（等级分数线等） |
| `assessment_operation_logs` | 操作日志 |
| `counselor_scopes` | 辅导员管辖范围 |
| `evaluation_results` | 最终评定结果（每学生每批次一条） |
| `evaluation_config` | 权重配置和等级阈值 |
| `smart_fill_data` | 智能填表缓存 |

---

## 十二、前后端对应关系

```
前端路由                         后端路由                     控制器
─────────────────────────────────────────────────────────────────
/module3/batch-manage      →  /api/module3/batches/*     →  CRUD 批次
/module3/student/forms     →  /api/module3/student/*     →  学生表单
/module3/student/results   →  /api/module3/smart-result  →  智能填表结果
/module3/class-leader      →  /api/module3/pending       →  评价任务
/module3/counselor/*       →  /api/module3/counselor/*   →  辅导员操作
/module3/review-detail/:id →  /api/module3/forms/:id     →  审核详情
/module3/teacher/*         →  /api/module3/statistics    →  统计导出
/module3/account-manage    →  /api/module3/admin/*       →  账号管理
/module3/org-manage        →  /api/module3/org/*         →  组织管理
```
