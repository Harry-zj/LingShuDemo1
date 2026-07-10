# 灵枢规则系统 V2 完整设计 v4.1

> v4.1 核心变化：完整材料事实模型 + 规则匹配模型 + Rule Application + 稳定幂等

---

## 零、v4→v4.1 变更

| # | 问题 | 修正 |
|---|------|------|
| 1 | 规则缺"命中什么" | +`input_selector` / `condition_config` / `application_scope` / `group_by_config` |
| 2 | 事实被拆成字段 | → 一行一个完整事实，`fact_data JSON` |
| 3 | 匹配结果用 JSON 数组 | → `rule_match_runs` + `fact_rule_matches` 正式表 |
| 4 | 匹配和标准化顺序颠倒 | → 先标准化再匹配，标准化不覆盖原始数据 |
| 5 | 计算只有 hash 快照 | → `calculation_task_inputs` 正式关联 |
| 6 | 规则直接遍历执行 | → Rule Application 中间层（条件命中→生成应用实例→执行） |
| 7 | execution_key 含 attempt_no | → 移除，改为纯业务键，attempt 单独记录 |
| 8 | 单条规则立即暂停 | → 批量收集阻塞项，一次暂停 |
| 9 | 文档解析无版本 | → `document_parse_runs` + `doc_blocks.parse_run_id` |
| 10 | AI 解析所有结构 | → 确定性解析器 + AI 语义标注分离 |
| 11 | 文档数错、查分表二维、formula_ast 范围错 | → 修正 |
| 12 | 缺完整示例 | → 第十四章端到端示例 |

---

## 一、概念定义

```
Material         学生申报的材料项目（证据容器）
Attachment       材料下上传的具体文件（图片/PDF/Word）
Material Analysis Run  对材料+附件的一次AI分析
Extracted Fact   从材料中提取的结构化客观事实（一行一个完整事实）
Fact Source      事实来自哪个附件的哪个位置
Fact-Rule Match  AI判断某个事实是否符合某条规则条件（只输出 pass/fail/uncertain）
Rule Application 规则定义 + 命中事实/事实组 + 作用范围 → 评分引擎实际执行对象
Calculation Result  规则应用经过去重/封顶/汇总后的最终结果
```

---

## 二、修正后的核心实体关系图

```
source_documents
  │
  └── 1:N → document_parse_runs（解析版本）
              │  parser_version / model / prompt_version / input_hash
              │
              └── 1:N → doc_blocks（parse_run_id）
                          │  block_type / content / structured_content
                          │
                          └── M:N → doc_block_relations
                                      annotates / describes / continues / belongs_to

rule_set_documents（M:N，带 document_role + parse_run_id）
  │
  └── M:1 → rule_sets（published 后冻结）
              │
              ├── 1:N → indicator_nodes
              ├── 1:N → rule_packages
              │           └── 1:N → executable_rules（含 input_selector / condition / scope / group_by）
              ├── 1:N → lookup_tables → lookup_cells
              ├── 1:N → rule_conflicts → rule_conflict_items
              └── 1:N → rule_source_refs

materials
  │
  └── 1:N → attachments
  │
  └── 1:N → material_analysis_runs
              │  model / prompt_version / input_hash（附件+配置）/ output_hash（事实）
              │
              ├── 1:N → extracted_facts（一行一个完整事实）
              │            fact_key / fact_type / fact_data JSON / semantic_hash
              │            │
              │            └── 1:N → extracted_fact_sources
              │                        attachment_id / source_locator / raw_excerpt
              │
              └── 1:N → rule_match_runs
                          │  rule_set_id / analysis_run_id / prompt_version
                          │
                          └── 1:N → fact_rule_matches
                                      fact_id / rule_id / condition / confidence / reason

calculation_tasks
  │  student_id / requested_by / current_stage / checkpoint / status
  │
  ├── 1:N → calculation_task_inputs
  │           material_id / analysis_run_id / match_run_id / input_hash
  │
  ├── 1:N → calculation_rule_applications
  │           exec_rule_id / application_scope / fact_id / group_key / indicator_id
  │           / application_key / status
  │
  ├── 1:N → calculation_rule_results
  │           execution_key / rule_application_id / score_before / score_change / score_after
  │
  ├── 1:N → calculation_metric_results
  │           indicator_id / raw_score / adjusted_score / final_score
  │
  └── 1:N → calculation_steps
```

---

## 三、关键表 DDL

### 3.1 文档解析版本

```sql
CREATE TABLE document_parse_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_document_id INT NOT NULL,
  parser_version VARCHAR(20) DEFAULT 'v1',
  model_name VARCHAR(50),
  prompt_version VARCHAR(20),
  input_hash CHAR(64),
  raw_ai_response LONGTEXT,
  status ENUM('running','completed','failed') DEFAULT 'running',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL
);

-- doc_blocks 关联 parse_run
ALTER TABLE doc_blocks ADD COLUMN parse_run_id INT NOT NULL;

-- 文档块关系
CREATE TABLE doc_block_relations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_block_id INT NOT NULL,
  target_block_id INT NOT NULL,
  relation_type ENUM('annotates','describes','continues','belongs_to') NOT NULL,
  confidence DECIMAL(5,4),
  UNIQUE KEY (source_block_id, target_block_id, relation_type)
);
```

### 3.2 可执行规则（条件 + 作用范围）

```sql
ALTER TABLE executable_rules ADD COLUMN input_selector JSON DEFAULT NULL;
ALTER TABLE executable_rules ADD COLUMN condition_config JSON DEFAULT NULL;
ALTER TABLE executable_rules ADD COLUMN application_scope
  ENUM('per_fact','per_material','per_group','per_indicator','global') DEFAULT 'per_fact';
ALTER TABLE executable_rules ADD COLUMN group_by_config JSON DEFAULT NULL;
```

示例：
```json
// 固定加分: 国家级 +5
{
  "input_selector": { "fact_type": "award", "required_fields": ["level"] },
  "condition_config": { "field": "level", "operator": "==", "value": "national" },
  "application_scope": "per_fact",
  "config": { "score": 5 }
}

// 查分表: 三维匹配
{
  "input_selector": { "fact_type": "award", "required_fields": ["level", "rank", "role"] },
  "application_scope": "per_fact",
  "config": { "table_id": 3 }
}

// 同项目择高
{
  "application_scope": "per_group",
  "group_by_config": { "fields": ["competition_name"] },
  "config": { "strategy": "take_highest" }
}

// 指标上限
{
  "application_scope": "per_indicator",
  "condition_config": { "indicator_key": "moral.honor_title" },
  "config": { "max": 15 }
}
```

**安全约束**：
- `condition_config` 只允许: `field`, `operator`(`==`,`!=`,`<`,`>`,`<=`,`>=`,`in`,`contains`), `value`
- `condition_config` 不允许: 函数调用、嵌套条件、动态代码
- Schema 校验：AI 输出的 input_selector/condition_config 必须通过 JSON Schema 校验

### 3.3 材料事实

```sql
CREATE TABLE material_analysis_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_id INT NOT NULL,
  model_name VARCHAR(50),
  prompt_version VARCHAR(20),
  parser_version VARCHAR(20) DEFAULT 'v1',
  input_hash CHAR(64) NOT NULL,        -- 附件内容+分析配置的哈希
  output_hash CHAR(64),                -- 事实集合的哈希
  raw_ai_response LONGTEXT,
  status ENUM('running','completed','failed') DEFAULT 'running',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL
);

-- 一行 = 一个完整事实
CREATE TABLE extracted_facts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  analysis_run_id INT NOT NULL,
  fact_key VARCHAR(100) NOT NULL,       -- f1, f2, ...
  fact_type ENUM('award','position','activity','certificate','score','duration','count','text','other'),
  fact_data JSON NOT NULL,
  /*
  {"competition_name":"全国数学建模竞赛","level":"national",
   "award_rank":"first","role":"leader","date":"2025-05","organizer":"教育部"}
  */
  semantic_hash CHAR(64),              -- SHA-256(规范化fact_data)
  confidence DECIMAL(5,4),
  status ENUM('active','superseded') DEFAULT 'active',
  UNIQUE KEY (analysis_run_id, fact_key)
);

-- 事实来源（多附件 → 同一事实）
CREATE TABLE extracted_fact_sources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  extracted_fact_id INT NOT NULL,
  attachment_id INT NOT NULL,
  source_locator VARCHAR(200),
  raw_excerpt TEXT,
  confidence DECIMAL(5,4),
  UNIQUE KEY (extracted_fact_id, attachment_id)
);
```

### 3.4 规则匹配

```sql
CREATE TABLE rule_match_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_set_id INT NOT NULL,
  analysis_run_id INT NOT NULL,
  model_name VARCHAR(50),
  prompt_version VARCHAR(20),
  input_hash CHAR(64),
  raw_ai_response LONGTEXT,
  status ENUM('running','completed','failed') DEFAULT 'running',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL
);

CREATE TABLE fact_rule_matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_run_id INT NOT NULL,
  extracted_fact_id INT NOT NULL,
  executable_rule_id INT NOT NULL,
  match_condition ENUM('pass','fail','uncertain') NOT NULL,
  confidence DECIMAL(5,4),
  reason TEXT,
  review_status ENUM('pending','confirmed','rejected') DEFAULT 'pending',
  UNIQUE KEY (match_run_id, extracted_fact_id, executable_rule_id)
);
-- ★ AI 不得返回 score。分数由后续 rule application 从 executable_rules.config 读取
```

### 3.5 计算任务输入

```sql
CREATE TABLE calculation_task_inputs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  calculation_task_id INT NOT NULL,
  material_id INT NOT NULL,
  analysis_run_id INT NOT NULL,
  match_run_id INT NOT NULL,
  input_hash CHAR(64),
  UNIQUE KEY (calculation_task_id, material_id)
);
-- 锁定: rule_set_id 在 calculation_tasks 中, analysis/match run 在此表
-- 历史任务不读材料最新结果
```

### 3.6 Rule Application

```sql
CREATE TABLE calculation_rule_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  calculation_task_id INT NOT NULL,
  executable_rule_id INT NOT NULL,
  application_scope ENUM('per_fact','per_material','per_group','per_indicator','global') NOT NULL,
  fact_id INT DEFAULT NULL,
  material_id INT DEFAULT NULL,
  group_key VARCHAR(200) DEFAULT NULL,
  indicator_id INT DEFAULT NULL,
  application_key CHAR(64) NOT NULL,   -- SHA-256(task_id+rule_id+scope+fact+group+indicator)
  status ENUM('pending','executing','applied','skipped','blocked','failed') DEFAULT 'pending',
  UNIQUE KEY uk_application (calculation_task_id, application_key)
);
```

### 3.7 calculation_rule_results（修正 execution_key）

```sql
-- execution_key = SHA-256(task_id + rule_id + application_scope + fact_id + group_key + indicator_id)
-- 不包含 attempt_no
ALTER TABLE calculation_rule_results MODIFY execution_key CHAR(64) NOT NULL;
ALTER TABLE calculation_rule_results ADD COLUMN rule_application_id INT;
ALTER TABLE calculation_rule_results ADD COLUMN attempt_no INT DEFAULT 1;

-- 重试记录
CREATE TABLE calculation_rule_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_result_id INT NOT NULL,
  attempt_no INT NOT NULL,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  error_msg TEXT,
  status ENUM('running','success','failed') DEFAULT 'running'
);
```

---

## 四、规范化流程

### 4.1 事实标准化

```
原始 extracted_facts
  → 读 normalization 规则
  → 创建标准化事实视图（不修改原始 fact_data）
  → 标准化视图 = 原始事实 + 派生字段

示例:
  原始: { "competition_name": "全国大学生数学建模竞赛" }
  标准化: { "level": "national", "category": "intellectual" }
  → 在匹配和执行上下文中使用合并后的完整视图
```

### 4.2 规则匹配

```
标准化事实
  → 调 AI ruleMatch（System: RULE_MATCH_SYSTEM, User: 规则摘要 + 标准化事实）
  → AI 返回 candidates[]: { rule_id, condition, confidence, reason, fact_id }
  → 写入 rule_match_runs + fact_rule_matches
  → match_condition 分流:
      pass → 可生成 Rule Application
      uncertain → 标记 review_status='pending'，用户可确认
      fail → 不生成
```

### 4.3 Rule Application 编译

```
输入: calculation_task 关联的 fact_rule_matches (condition='pass')
      + executable_rules 的 application_scope / group_by_config

编译:

  for each fact_rule_match (condition='pass'):
    rule = executable_rules[match.rule_id]

    switch rule.application_scope:
      per_fact:
        → application = { scope:'per_fact', fact_id, exec_rule_id }
        → application_key = SHA(task_id+rule_id+per_fact+fact_id)

      per_group:
        → 按 rule.group_by_config 对所有匹配事实分组
        → 每组生成一个 application
        → application_key = SHA(task_id+rule_id+per_group+group_key)

      per_indicator:
        → 每个指标生成一个 application
        → application_key = SHA(task_id+rule_id+per_indicator+indicator_id)

      global:
        → 仅一个 application

  写入 calculation_rule_applications
```

### 4.4 评分引擎执行（修正版）

```
for each stage in [precheck, normalization, eligibility, base_score,
                   adjustment, deduplication, cap, aggregation,
                   post_aggregation, outcome]:

  UPDATE current_stage = stage

  stage_applications = 属于本 stage 的 calculation_rule_applications

  ★ 收集本阶段所有 blocking items
  blocking_reviews = []

  for each app in stage_applications (拓扑排序):

    if app 依赖未满足 → skip (blocked)
    if app 被 override 阻止 → skip (blocked)
    if app 被 exclusion → 按策略处理

    if app.rule.auto_level == 'manual_required':
      blocking_reviews.push(app)       ← ★ 不立即暂停
      continue

    executor = getExecutor(app.rule.rule_type, app.rule.config_version)
    result = executor.execute(app, context)   ← 确定性执行，无AI

    INSERT calculation_rule_result
      (execution_key, rule_application_id, score_before, score_change, score_after,
       input_snapshot, output_snapshot, exec_status='applied')
    INSERT calculation_step

  ★ 阶段结束后统一处理:
  if blocking_reviews.length > 0:
    INSERT manual_review_tasks (批量)
    UPDATE task SET status='waiting_review', checkpoint={stage,completed_app_ids}
    BREAK
```

---

## 五、人工审核（批量暂停）

### 区分两种审核

| 类型 | 行为 | 示例 |
|------|------|------|
| `blocking_review` | 阻止进入下一阶段 | 人工规则、无法确定级别的事实 |
| `assisted_warning` | 允许继续，结果标记暂定 | 置信度偏低但AI判断为pass |

### 暂停流程

```
当前阶段执行完毕
  → 收集全部 blocking_review applications
  → 批量 INSERT manual_review_tasks (每条一个 task)
  → calculation_task → waiting_review
  → 前端: "本阶段有 N 项需要审核"

恢复条件:
  → 本阶段所有 blocking_review tasks 状态 = 'resolved'
  → POST /api/v2/calculations/:id/resume
  → status → resuming
  → 从 checkpoint.stage 恢复
  → 通过 application_key 判断幂等（已存在的 skip）
```

---

## 六、execution_key 与幂等

```
execution_key = SHA-256(
  task_id + ":" +
  executable_rule_id + ":" +
  application_scope + ":" +
  (fact_id || "0") + ":" +
  (group_key || "") + ":" +
  (indicator_id || "0")
)

规则:
  - 不包含 attempt_no
  - 同一个 application_key 在整个 task 中只执行一次
  - 恢复时: 检查 execution_key 是否已存在 → 存在则 skip
  - 重试: INSERT INTO calculation_rule_attempts (新 attempt_no)
  - 重试不改变 execution_key
```

---

## 七、历史追溯链

```
calculation_metric_results.final_score
  ↓
calculation_rule_results
  → calculation_rule_applications (application_scope, fact_id...)
    → executable_rules (rule definition + config)
      → rule_packages → indicator_nodes → rule_sets
    → fact_rule_matches
      → extracted_facts
        → extracted_fact_sources → attachments → materials
      → rule_match_runs (rule_set_id, analysis_run_id)
        → material_analysis_runs

calculation_task_inputs
  → 锁定 analysis_run_id + match_run_id

历史任务:
  → 通过 calculation_task_inputs 找到当时使用的 analysis_run 和 match_run
  → 规则通过 rule_set_id（published 后不可变）
  → 不读材料的当前最新分析
```

---

## 八、V2.0 实现边界

### 必须实现

```
document_parse_runs + doc_blocks + doc_block_relations
indicator_nodes + rule_packages
executable_rules（14 种类型 + input_selector/condition/scope/group_by）
lookup_tables（多维）+ dimension_hash
material_analysis_runs + extracted_facts + extracted_fact_sources
rule_match_runs + fact_rule_matches
calculation_task_inputs
calculation_rule_applications
calculation_rule_results（含 execution_key）
calculation_metric_results
calculation_steps
manual_review_tasks（批量暂停）
rule_set freezing
consistency check
```

### 执行器

```
V2.0 实现: fixed, per_unit, lookup, normalization, coefficient,
           dedup, cap, override, outcome_constraint, evidence_policy, manual
V2.0 建模不执行: tiered, formula_ast, eligibility(复杂)
```

---

## 九、端到端示例

> 学生上传两份附件 → 提取一个获奖事实 → 匹配查分规则 → 执行 → 看结果

```
[1] 材料
    Material(id=10) "数学建模竞赛获奖"
      Attachment(id=101) "证书.jpg"（显示"全国大学生数学建模竞赛一等奖"）
      Attachment(id=102) "公示名单.pdf"（显示"张三，全国大学生数学建模竞赛，团队负责人"）

[2] 材料分析
    material_analysis_run(id=5, model='deepseek-chat', prompt_version='v2.1',
                          input_hash='abc123...')
      ↓ AI 事实提取
    extracted_facts:
      fact_key='f1', fact_type='award',
      fact_data={
        "competition_name":"全国大学生数学建模竞赛",
        "level_hint":"原文使用'全国'二字",
        "award_rank":"一等奖",
        "role":"团队负责人",
        "date":"2025-05",
        "organizer":"中国工业与应用数学学会"
      },
      confidence=0.92

    extracted_fact_sources:
      - (fact_id=f1, attachment_id=101, source_locator="证书正文第1-3行")
      - (fact_id=f1, attachment_id=102, source_locator="名单第5行, 第3列")

    output_hash='def456...'

[3] 标准化
    normalization 规则: 赛事名称标准化映射
    "全国大学生数学建模竞赛" → level='national', category='intellectual'
    → 标准化视图: { ...原始fact_data, level:'national', category:'intellectual' }

[4] 规则匹配
    rule_match_run(id=3, rule_set_id=1, analysis_run_id=5)
      ↓ AI 匹配
    fact_rule_matches:
      - (fact_id=f1, rule_id=25, condition='pass', confidence=0.88,
         reason="'全国大学生数学建模竞赛'匹配查分表[intellectual竞赛]，一等奖+团队负责人")
      - (fact_id=f1, rule_id=30, condition='pass', confidence=0.85,
         reason="教育部下属学会主办，满足evidence_policy要求")

[5] 创建计算任务
    calculation_task(id=100, rule_set_id=1, student_id=5, status='pending')
    calculation_task_inputs:
      - material_id=10, analysis_run_id=5, match_run_id=3

[6] 编译 Rule Applications
    从 fact_rule_matches + executable_rules 编译:

    app_1: (rule_id=25, scope='per_fact', fact_id=f1)  -- 查分表
    app_2: (rule_id=30, scope='per_fact', fact_id=f1)  -- evidence_policy
    app_3: (rule_id=35, scope='per_group', group_key='数学建模竞赛') -- 同项目择高
    app_4: (rule_id=40, scope='per_indicator', indicator_id=3) -- 上限15

[7] 执行
    precheck:
      app_2(evidence_policy): 证书+名单齐全 → sufficient → applied
    base_score:
      app_1(lookup): level=national + rank=first + role=leader → 10 → applied
    deduplication:
      app_3(dedup): 本组仅一个应用 → skipped (nothing to dedup)
    cap:
      app_4(cap): 10 ≤ 15 → applied (cap not triggered)

[8] 结果
    calculation_rule_results:
      - execution_key=abc1, score_change=+10, exec_status='applied' (lookup)
      - execution_key=abc2, score_change=0, exec_status='applied' (evidence)
      - execution_key=abc3, score_change=0, exec_status='skipped' (dedup)
      - execution_key=abc4, score_change=0, exec_status='applied' (cap)

    calculation_metric_results:
      indicator_id=3, raw_score=10, adjusted_score=10, final_score=10

    calculation_steps: 4步，每步可读

[9] 用户查看解释
    总分: 竞赛加分 10 分
    点击展开:
      📄 事实: 全国大学生数学建模竞赛（national, 一等奖, 团队负责人）
      📎 来源: 证书.jpg（证书正文第1-3行），公示名单.pdf（第5行第3列）
      📊 查分表: national × 一等奖 × 负责人 = 10 分
      🔒 上限15分: 未触发（10≤15）
      📖 规则原文: 2025综测办法 第12页 表格3 "竞赛加分查分表"
```

---

## 十、预计新增/修改文件

| 文件 | 操作 |
|------|------|
| `db/init_v2.sql` | 新建：完整V2表结构 |
| `engine/scoringEngine.js` | 新建 |
| `engine/executors/*.js` | 新建：11个执行器 |
| `engine/applicationCompiler.js` | 新建：Rule Application 编译 |
| `engine/formulaEngine.js` | 新建：AST执行 |
| `engine/consistencyChecker.js` | 新建 |
| `engine/freezeService.js` | 新建 |
| `controllers/zongce/ruleSetController.js` | 新建 |
| `controllers/zongce/scoringController.js` | 新建 |
| `controllers/zongce/ruleController.js` | 修改：接入 document_parse_run |
| `controllers/zongce/materialController.js` | 修改：接入 analysis_run + match_run |
| `services/zongce/ai/ruleParser.js` | 修改：分步解析 |
| `services/zongce/ai/factExtractor.js` | 修改：输出 extracted_facts 格式 |
| `services/zongce/ai/ruleMatcher.js` | 修改：写 fact_rule_matches |
| `services/zongce/ai/promptTemplates.js` | 修改：分步 Prompt |
| `services/zongce/ai/schemas.js` | 修改：新类型 Schema |
| `client/src/views/zongce/RuleSetView.vue` | 新建 |
| `client/src/views/zongce/SmartFillRule.vue` | 修改：摘要展示 |
