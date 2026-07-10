# 灵枢规则系统 V2 完整设计（最终版 v4）

---

## 零、v3→v4 修正清单

| # | 修正点 | 方案 |
|---|--------|------|
| 1 | 规则集发布需冻结来源 | source_documents 加 frozen_at/file_hash，发布时级联冻结 |
| 2 | 计算暂停/恢复 | 7 状态 + checkpoint + resuming 幂等 |
| 3 | 规则执行结果唯一标识 | execution_key = task_id:rule_id:fact_id:group_key:attempt |
| 4 | 材料事实版本 | material_analysis_runs + extracted_facts，计算任务引用快照 |
| 5 | excludes 与依赖分离 | executable_rule_dependencies(requires/after) + executable_rule_exclusions |
| 6 | override 终止语义 | set_value / set_and_lock / stop_indicator / stop_calculation |
| 7 | 证明材料统一 | evidence_policy 为唯一执行依据，proof_required 降为摘要 |
| 8 | 计算精度 | 中间 DECIMAL(12,4)，最终 DECIMAL(8,2)，ROUND_HALF_UP |
| 9 | 上下限去重 | indicator 存无条件上下限，cap 存条件性限制，编译时检测冲突 |
| 10 | 外键和作用域 | 补齐所有外键 + Service 层同 rule_set 作用域校验 |
| 11 | 查分表哈希统一 | sort_order → 固定数组 → 标准序列化 → SHA-256 |
| 12 | V2.0 执行器范围 | 9 种必须实现，4 种建模但标记 manual_required |

---

## 一、核心实体关系图（最终版）

```
source_documents（上传文件，发布时冻结）
  │  file_hash / is_frozen / frozen_at
  │
  ├── 1:N → doc_blocks（结构化文档块，发布时冻结）
  │           block_type / content / structured_content
  │
  └── M:N → rule_set_documents（角色/优先级/合并方式）
              │
              └── M:1 → rule_sets（规则集，published 后全链路冻结）
                          │  version_label / status / cloned_from_id
                          │
                          ├── 1:N → indicator_nodes（canonical_key 唯一）
                          │           calc_method / formula_ast / min_score / max_score
                          │           │
                          │           └── 1:N → rule_packages（规则包）
                          │                       auto_level / summary
                          │                       │
                          │                       └── 1:N → executable_rules
                          │                                   rule_type / config / config_version
                          │                                   execution_stage / priority
                          │                                   │
                          │                                   ├── M:N → executable_rule_dependencies
                          │                                   │           requires / after
                          │                                   └── M:N → executable_rule_exclusions
                          │                                               rule_a / rule_b / resolution_strategy
                          │
                          ├── 1:N → lookup_tables → 1:N → lookup_dimensions
                          │                              1:N → lookup_cells（dimension_hash 唯一）
                          │
                          ├── 1:N → rule_conflicts → 1:N → rule_conflict_items
                          │
                          ├── 1:N → manual_review_tasks
                          │           review_stage / target_type / target_id
                          │           上下文: rule_set_id / calculation_task_id / material_id
                          │
                          └── 1:N → calculation_tasks
                                      student_id / requested_by / status / checkpoint
                                      │
                                      ├── 1:N → calculation_metric_results（每指标最终结果）
                                      ├── 1:N → calculation_rule_results（每规则执行结果，execution_key 唯一）
                                      └── 1:N → calculation_steps（详细步骤轨迹）

材料事实版本（独立于规则系统）:
  materials → 1:N → material_analysis_runs → 1:N → extracted_facts
                                                   fact_id / fact_type / value_json / confidence
```

### 通用来源追踪

```
rule_source_refs
  entity_type（白名单枚举）/ entity_id / doc_block_id
  relation_type: defines / modifies / overrides / clarifies / provides_evidence
```

---

## 二、关键 DDL 修正

### 2.1 source_documents（冻结支持）

```sql
ALTER TABLE source_documents ADD COLUMN file_hash CHAR(64) DEFAULT NULL;
ALTER TABLE source_documents ADD COLUMN is_frozen TINYINT(1) DEFAULT 0;
ALTER TABLE source_documents ADD COLUMN frozen_at TIMESTAMP NULL;
```

### 2.2 doc_blocks（冻结支持）

```sql
ALTER TABLE doc_blocks ADD COLUMN is_frozen TINYINT(1) DEFAULT 0;
```

### 2.3 executable_rule_exclusions（独立互斥表）

```sql
CREATE TABLE executable_rule_exclusions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_a_id INT NOT NULL,
  rule_b_id INT NOT NULL,
  resolution_strategy ENUM('take_higher_priority','take_higher_score','manual_review','keep_first') DEFAULT 'manual_review',
  UNIQUE KEY (rule_a_id, rule_b_id),
  CHECK (rule_a_id < rule_b_id),   -- ★ 防止 A-B 和 B-A 重复
  FOREIGN KEY (rule_a_id) REFERENCES executable_rules(id) ON DELETE CASCADE,
  FOREIGN KEY (rule_b_id) REFERENCES executable_rules(id) ON DELETE CASCADE
);
```

### 2.4 calculation_tasks（暂停恢复支持）

```sql
ALTER TABLE calculation_tasks ADD COLUMN current_stage VARCHAR(50) DEFAULT NULL;
ALTER TABLE calculation_tasks ADD COLUMN checkpoint JSON DEFAULT NULL;
ALTER TABLE calculation_tasks ADD COLUMN engine_version VARCHAR(20) DEFAULT 'v1';
ALTER TABLE calculation_tasks ADD COLUMN input_snapshot_hash CHAR(64) DEFAULT NULL;
-- status 扩展
ALTER TABLE calculation_tasks MODIFY status ENUM(
  'pending','running','waiting_review','resuming','completed','failed','cancelled'
) DEFAULT 'pending';
```

### 2.5 calculation_rule_results（execution_key）

```sql
ALTER TABLE calculation_rule_results ADD COLUMN execution_key VARCHAR(300) NOT NULL;
ALTER TABLE calculation_rule_results ADD COLUMN fact_id VARCHAR(50) DEFAULT NULL;
ALTER TABLE calculation_rule_results ADD COLUMN group_key VARCHAR(100) DEFAULT NULL;
ALTER TABLE calculation_rule_results ADD COLUMN attempt_no INT DEFAULT 1;
ALTER TABLE calculation_rule_results ADD UNIQUE KEY uk_execution (task_id, execution_key);
```

### 2.6 材料事实版本表

```sql
CREATE TABLE material_analysis_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_id INT NOT NULL,
  model_name VARCHAR(50),
  prompt_version VARCHAR(20),
  input_hash CHAR(64),
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL
);

CREATE TABLE extracted_facts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  analysis_run_id INT NOT NULL,
  attachment_id INT DEFAULT NULL,
  fact_id VARCHAR(50) NOT NULL,        -- f1, f2, ...
  fact_type ENUM('award','position','activity','certificate','score','duration','count','text','other'),
  field_name VARCHAR(100),             -- 如 "award_name", "hours", "rank"
  value_json JSON NOT NULL,            -- {"raw":"全国数学建模竞赛","normalized":"national"}
  confidence DECIMAL(5,4),
  source_locator VARCHAR(200),         -- 原文定位
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY (analysis_run_id, fact_id)
);
```

### 2.7 calculation_tasks 引用事实版本

```sql
-- calculation_tasks 关联 analysis_run
-- 通过 JOIN materials → material_analysis_runs 获取事实快照
-- 或在 calculation_task 创建时复制 fact_ids 和 analysis_run_ids 到 input_snapshot_hash
```

---

## 三、V2.0 执行器范围

| rule_type | V2.0 状态 | 说明 |
|-----------|----------|------|
| `fixed` | ✅ 实现 | 固定加减分 |
| `per_unit` | ✅ 实现 | 按次数/时长计分 |
| `lookup` | ✅ 实现 | 查分表（二维，哈希唯一） |
| `normalization` | ✅ 实现 | 赛事→级别标准化映射 |
| `coefficient` | ✅ 实现 | 系数调整 |
| `dedup` | ✅ 实现 | 择高/去重 |
| `cap` | ✅ 实现 | 上下限（min+max） |
| `override` | ✅ 实现 | 覆写（set_value/set_and_lock/stop_indicator） |
| `outcome_constraint` | ✅ 实现 | 结果约束（不合格等） |
| `evidence_policy` | ✅ 实现 | 材料证明要求判断 |
| `manual` | ✅ 实现 | 暂停→生成审核任务 |
| `tiered` | ⚠️ 建模不执行 | 阶梯计分，保存配置 + 标记 manual_required |
| `formula_ast` | ⚠️ 建模不执行 | AST 公式，保存 + 校验 + 标记 manual_required |
| `eligibility` | ⚠️ 建模不执行 | 复杂资格判断，简单条件走 override |

**不执行的规则处理**：正确保存 config，标记 `auto_level='manual_required'`，发布时生成审核任务，算分时暂停等待人工。

---

## 四、计算精度规范

| 位置 | 精度 | 舍入 |
|------|------|------|
| 中间计算 | DECIMAL(12,4) | 不提前舍入 |
| 规则 `score` | DECIMAL(6,2) | — |
| `per_unit` 单位分值 | DECIMAL(8,4) | — |
| `coefficient` 系数 | DECIMAL(5,4) | — |
| AST 中间结果 | DECIMAL(12,4) | — |
| `calculation_metric_results.final_score` | DECIMAL(8,2) | ROUND_HALF_UP |
| `calculation_tasks.total_score` | DECIMAL(8,2) | ROUND_HALF_UP |
| 前端展示 | 2 位小数 | — |

原文要求"最终保留两位"时：在 aggregation 阶段集中舍入，不在中间步骤舍入。

---

## 五、上下限职责划分

| 来源 | 用途 | 示例 |
|------|------|------|
| `indicator_nodes.min_score / max_score` | 无条件固定上下限 | "课堂表现最低0分" |
| `rule_type='cap'` | 条件性、局部性、带例外的上下限 | "国家级竞赛上限15分（省级10分）" |

冲突检测：编译时检查 indicator cap 与 cap 规则是否矛盾（如 indicator.max=10 但 cap 设 max=15），矛盾 → rule_conflicts。

---

## 六、证明材料统一

```
evidence_policy  ← 唯一执行依据（rule_type='evidence_policy'）
  config: { required, on_missing, external_verification }

proof_required  ← 降级为自动生成摘要（不可独立编辑，从 evidence_policy 同步）
```

判断结果：

| 结果 | 影响 |
|------|------|
| `sufficient` | 正常匹配 + 算分 |
| `insufficient` | 规则匹配降级为 uncertain + 生成审核任务 |
| `uncertain` | 标记 assisted + 前端展示黄色预警 |
| `requires_external_verification` | 暂停 + 生成审核任务 |

---

## 七、Override 执行语义

| 模式 | 行为 | 被跳过规则 | 父指标 |
|------|------|-----------|--------|
| `set_value` | 设固定值 | 当前规则之后的同指标 base_score 规则 | 正常汇总 |
| `set_and_lock` | 设固定值并锁定 | 当前规则之后所有同指标规则（含 adjustment/cap） | 正常汇总锁定的值 |
| `stop_indicator` | 终止本指标 | 当前及后续同指标所有规则 | 父指标以此为终值 |
| `stop_calculation` | 终止全部计算 | 所有后续规则 | 直接跳到 outcome |

被跳过规则：`exec_status='blocked'`，保留在 `calculation_rule_results` 中。

---

## 八、规则依赖与互斥模型

### 依赖（参与拓扑排序）

```sql
executable_rule_dependencies (rule_id, depends_on_rule_id, dependency_type)
  requires: A 需要 B 的输出 → B 必须先执行
  after:    A 必须在 B 之后 → 排序约束，但不依赖输出
```

### 互斥（不参与拓扑排序）

```sql
executable_rule_exclusions (rule_a_id, rule_b_id, resolution_strategy)
  take_higher_priority:  自动选 priority 高的
  take_higher_score:     自动选产出分高的
  manual_review:         生成审核任务
  keep_first:            保留先执行的
```

- 互斥规则**允许**跨规则包、跨指标
- 同时命中两条互斥规则时：按 resolution_strategy 处理
- 无策略 → 生成 manual_review_task

---

## 九、规则集冻结流程

```
用户点击"发布"
  → 全量一致性检查（见第十二章流程六）
  → 所有检查通过
  → BEGIN TRANSACTION
      对以下实体设置 is_frozen=1, frozen_at=NOW():
        source_documents（WHERE id IN rule_set_documents）
        doc_blocks（WHERE source_document_id IN ...）
        indicator_nodes（WHERE rule_set_id=?）
        rule_packages（WHERE rule_set_id=?）
        executable_rules（WHERE package_id IN ...）
        executable_rule_dependencies
        executable_rule_exclusions
        lookup_tables / lookup_dimensions / lookup_cells
        rule_source_refs
      UPDATE rule_sets SET status='published', published_at=NOW()
    COMMIT
```

**禁止操作**：任何 is_frozen=1 的行不可 UPDATE/DELETE。Service 层统一检查。

---

## 十、V2.0 预计新增/修改文件

### 新建

```
server/src/services/zongce/db/init_v2.sql           ← V2 新表
server/src/services/zongce/db/migrate_v2.js          ← V1→V2 迁移（保留旧表）
server/src/services/zongce/engine/scoringEngine.js    ← 评分引擎
server/src/services/zongce/engine/ruleExecutors/      ← 各类型执行器
  fixed.js / per_unit.js / lookup.js / normalization.js
  coefficient.js / dedup.js / cap.js / override.js
  outcome_constraint.js / evidence_policy.js / manual.js
server/src/services/zongce/engine/formulaEngine.js    ← AST 公式安全执行
server/src/services/zongce/engine/consistencyChecker.js← 一致性检查
server/src/services/zongce/engine/freezeService.js    ← 冻结服务
server/src/controllers/zongce/ruleSetController.js    ← 规则集 CRUD + 发布
server/src/controllers/zongce/scoringController.js    ← 算分 + 暂停恢复
client/src/views/zongce/RuleSetView.vue               ← 规则摘要页
```

### 修改

```
promptTemplates.js    ← 分步 Prompt（文档结构→指标→规则包→编译）
schemas.js            ← 新 Schema
ruleParser.js         ← 调用新解析链
database.js           ← 执行 init_v2.sql
evaluationController  → 废弃，替代为 scoringController
SmartFillRule.vue     ← 改为规则摘要展示
```

---

## 十一、完整流程（14 个阶段）

### 流程一：规则文件上传与版本创建

```
用户选择文件
  → 前端 FormData → POST /api/v2/rules/upload
  → multer 存文件到 server/uploads/
  → controller:
      计算文件哈希 SHA-256(file)
      检查是否已存在相同哈希的 source_document
      → 存在 → 复用
      → 不存在 → INSERT source_documents (file_name, file_path, file_hash, status='pending')
  → INSERT rule_sets (user_id, status='draft', version_label=自动生成)
  → INSERT rule_set_documents (rule_set_id, source_document_id, role='primary', merge_mode='append')
  → 返回 { rule_set_id, source_document_id }
  → 前端跳转到规则集页面

失败: status='pending' 保留，用户可重试
```

### 流程二：文档结构恢复

```
触发: POST /api/v2/rules/sets/:id/parse-structure
  → 创建 ai_task (target_type='doc_structure', status='processing')
  → 后台异步执行:
      1. 读取 source_document.original_text
         - .docx → mammoth 提取文本 + 段落结构
         - .pdf  → pdf-parse 提取文本
         - .xlsx → xlsx 提取表格
         - 图片  → OCR 提取文字
      2. 调 AI (RULE_PARSE_SYSTEM → docStructure variant):
         System: "你是文档结构化解析器。将文档拆分为段落、标题、表格、
                  列表、备注、公式。保留编号层级和原文顺序。"
         User: 文档原文
      3. AI 返回:
         { "blocks": [
             { "type":"heading","level":1,"title":"一、德育加分",
               "content":"...","order":1 },
             { "type":"table","title":"竞赛加分表","content":"...",
               "structured_content":{"rows":[...],"header_rows":[0]},
               "order":5 },
             { "type":"note","content":"注：同类不重复加分","order":6 }
           ]}
      4. 校验: 每个 block 必须含 type+order
      5. 事务写入 doc_blocks:
         INSERT (source_document_id, block_type, title, content,
                 structured_content, source_location, parent_id, order_index)
      6. 建立父子和相邻关系: 表格后面的备注关联到表格
      7. 更新 ai_task.status='completed'

  进度: SSE 推送给前端（每完成一种 block 类型）

表格上下文保持:
  表格 block (order=5) 前后的 note block (order=4,6) 通过 order_index 相邻定位。
  AI 需识别表格和其标题、备注的关联关系。
```

### 流程三：指标树识别

```
触发: POST /api/v2/rules/sets/:id/parse-indicators
  → 创建 ai_task
  → 后台:
      1. 读取所有 doc_blocks
      2. 调 AI (indicatorTree variant):
         System: "你是指标树解析器。从文档结构中识别指标节点及其父子关系。
                  每个节点输出: code/name/parent_code/weight/calc_method/
                  max_score/min_score/suggested_key。
                  无法确定层级时标记 uncertainty。
                  不要猜测文档未写明的权重或公式。"
         User: doc_blocks JSON
      3. AI 返回:
         { "indicators": [
             { "code":"F1","name":"德育","parent_code":null,
               "calc_method":"sum_children","weight":0.2,
               "max_score":20,"suggested_key":"moral" },
             { "code":"F1.1","name":"荣誉称号加分","parent_code":"F1",
               "calc_method":"sum_children","max_score":15,
               "suggested_key":"moral.honor_title" }
           ],
           "uncertainties": [
             { "block_ids":[5,6],"issue":"无法确定F1.2是否属于F1还是独立指标" }
           ]}
      4. 校验: 无循环引用、所有 parent_code 指向存在的 code
      5. 生成 canonical_key: 对 suggested_key 规范化，冲突加短哈希
      6. 事务写入 indicator_nodes
      7. 写入 rule_source_refs (entity_type='indicator_node')
      8. uncertainties → manual_review_tasks

无法确定层级:
  → 生成 manual_review_task (review_stage='rule_parsing')
  → 指标仍然保存(标记 pending_review)
  → 用户可在规则集页面修正后确认
```

### 流程四：规则包解析

```
触发: POST /api/v2/rules/sets/:id/parse-packages
  → AI: "你是规则包解析器。将属于同一业务场景的计分方式、表格、备注、
          上限、例外、证明要求和人工裁量组合为规则包。
          不要生成大量孤立规则项。
          每个规则包包含: 所属指标、名称、摘要、自动化等级。"
  → AI 输出:
    { "packages": [
        { "indicator_code":"F1.1","name":"荣誉称号加分","auto_level":"automatic",
          "summary":"国家级+5/省级+3/校级+1，同类取最高，上限15分，
                    须提供证书扫描件",
          "associated_blocks":[3,4,5,6],
          "sub_rules":[
            {"type":"fixed","name":"国家级+5","config":{"score":5},
             "stage":"base_score","level":"national"},
            {"type":"fixed","name":"省级+3","config":{"score":3},
             "stage":"base_score","level":"provincial"},
            {"type":"dedup","name":"同类取最高",
             "config":{"strategy":"take_highest","group_by":["award_name"]},
             "stage":"deduplication"},
            {"type":"cap","name":"本项上限15",
             "config":{"max":15,"scope":"indicator"},"stage":"cap"}
          ],
          "proof_required":["证书扫描件"],
          "manual_items":[]
        }
      ]}
  → 事务写入 rule_packages + executable_rules + rule_source_refs
  → 规则包摘要直接展示给用户（不展开底层规则）
```

### 流程五：可执行规则编译

```
AI 已在上一步输出 sub_rules → 直接编译:

对每个 sub_rule:
  1. 分配 config_version（当前默认 "v1"）
  2. 按 config 结构匹配 JSON Schema
  3. 生成 canonical_key: {package_key}.{rule_slug}
  4. 确定 execution_stage（AI 建议 → 规则类型默认 → 可调整）
  5. 确定 priority（同阶段内排序）
  6. 建立依赖和互斥:
     - dedup 规则自动标记为 after 同包的 scoring 规则
     - cap 规则自动标记为 after 所有 scoring 规则
     - 显式 excludes 从 doc_blocks 中识别
  7. 不能自动编译的规则 → auto_level='manual_required' + manual_review_task
  8. INSERT executable_rules + executable_rule_dependencies + executable_rule_exclusions
```

### 流程六：一致性检查

```
触发: POST /api/v2/rules/sets/:id/check
  → 同步执行（不调AI，纯规则检查）:

检查项:
  1. 指标树循环
     → BFS/DFS 遍历 parent_id，检测环路
  2. canonical_key 冲突
     → SELECT canonical_key, COUNT(*) GROUP BY ... HAVING COUNT>1
  3. 规则依赖循环
     → 拓扑排序 + 环检测
  4. 查分表缺单元格
     → 维度笛卡尔积 vs 实际行数
  5. 上下限冲突
     → indicator.min/max vs cap config
  6. 公式变量缺失
     → AST 中所有 variable.name 在注册表
  7. 规则无来源
     → rule_source_refs 缺失
  8. 规则包无计分逻辑
     → package 下无 scoring 类型 executable_rule
  9. 人工规则未标记
     → manual 类型必须 auto_level='manual_required'
  10. 互斥规则检查
      → 同一 pair 不存在 A-B 和 B-A 重复

输出:
  { "pass": false,
    "errors": [ {"type":"cycle","detail":"F1→F1.1→F1"} ],
    "warnings": [ {"type":"no_source","entity":"exec_rule:15"} ],
    "manual_review_count": 3 }

前端:
  错误 → 阻止发布，展示详情
  警告 → 可发布但提醒
```

### 流程七：用户确认与规则发布

```
规则集页面展示摘要（不展开底层规则）:
  ┌──────────────────────────────────────┐
  │ 规则集: 2025综测办法 v1 (draft)       │
  │                                      │
  │ 📊 指标树: 12 个节点（3 个一级指标）   │
  │ 📦 规则包: 8 个（6 个自动，2 个需确认）│
  │ 📊 查分表: 2 个                       │
  │ ⚠️ 异常: 1 个冲突，3 个人工审核       │
  │                                      │
  │ [查看指标树] [查看规则包] [只看异常]    │
  │ [全部确认为正常] [发布规则集]           │
  └──────────────────────────────────────┘

用户点击"发布":
  → 全量一致性检查（流程六）
  → 全部通过
  → 冻结:
      source_documents.is_frozen=1, frozen_at=NOW()
      doc_blocks.is_frozen=1
      （规则实体通过 rule_set 的状态保护，不单独设 is_frozen）
  → rule_sets.status='published', published_at=NOW()
  → 此后该 rule_set 及其关联的所有实体不可修改
```

### 流程八：材料上传与事实提取

```
用户创建材料 → 上传附件
  → POST /api/v2/materials/:id/analyze
  → 创建 material_analysis_run (model_name, prompt_version)
  → 后台:
      对每个 attachment:
        - 图片 → OCR → 文字
        - 文档 → 提取文字
      调 AI factExtract（不传规则，只提取客观事实）
      → 返回 facts[] with fact_id, type, value_json, confidence, source_locator
  → 写入 extracted_facts（每条一个 fact_id）
  → 更新 analysis_run.completed_at + input_hash = SHA-256(facts)
  → material_recognitions 保留兼容，从 extracted_facts 同步

去重合并:
  多个 attachment 的事实按 fact_id+value 去重
  → 保留最高 confidence 的来源
```

### 流程九：材料与规则匹配

```
触发: POST /api/v2/materials/:id/match
  → 读取 published rule_set 的 executable_rules (auto_level≠manual_required)
  → 读取 extracted_facts
  → 调 AI ruleMatch:
      System: "判断事实是否符合规则条件。只返回 condition 和 fact_ids。"
      User: 规则列表（不含分数）+ 事实列表
  → AI 返回 candidates[] with rule_id, condition, fact_ids, confidence
  → 写入 material_recognitions.matched_rule_ids（保留兼容）
  → 匹配结果分流:
      automatic → 直接可用于算分
      assisted  → 前端标记黄色，用户可调整
      manual_required → 生成 manual_review_task

同项目多条材料:
  fact 级联: 多个材料提取到相同 fact（如两份证书都是同一个奖项）
  → fact_id 相同 → 去重
  → 匹配时同一个 rule 不会因为两个材料各命中一次而计两次
```

### 流程十：创建计算任务

```
触发: POST /api/v2/calculations
  Body: { rule_set_id, material_ids[] }

  → 验证 rule_set.status='published'
  → 锁定事实版本:
      找到每个 material 最新的 completed analysis_run
      → input_snapshot_hash = SHA-256(所有 analysis_run_ids + fact_ids)
  → 加载执行图:
      读取所有 executable_rules (status='confirmed')
      读取 executable_rule_dependencies
      读取 executable_rule_exclusions
      读取 indicator_nodes (构建指标树)
  → 拓扑排序 + disabled 规则排除
  → INSERT calculation_tasks
      (rule_set_id, student_id, requested_by, status='pending',
       engine_version='v2.0', input_snapshot_hash, current_stage=null)
  → 返回 task_id
```

### 流程十一：评分引擎执行

```
触发: POST /api/v2/calculations/:id/execute

状态: pending → running

for each stage in [precheck, normalization, eligibility, base_score,
                   adjustment, deduplication, cap, aggregation,
                   post_aggregation, outcome]:

  update current_stage = stage

  for each executable_rule in stage (拓扑排序 + priority 排序):

    1. 检查依赖是否满足 → 不满足 → skip (exec_status='blocked')
    2. 检查是否被 override 阻止 → 是 → skip (exec_status='blocked')
    3. 检查是否触发 exclusion → 是 → apply resolution_strategy
    4. 执行规则:
       - 读取输入（从 facts 或前置 rule_result）
       - 调用对应 executor 函数
       - 得到 output_value 和 explanation
    5. INSERT calculation_rule_result:
       (task_id, exec_rule_id, indicator_id, material_id, fact_id,
        execution_key, score_before, score_change, score_after,
        input_snapshot, output_snapshot, exec_status)
    6. INSERT calculation_step（详细轨迹）
    7. 如果是 manual 规则:
       → 创建 manual_review_task
       → 保存 checkpoint { stage, rule_id, completed_steps }
       → 任务进入 waiting_review → 暂停

    8. 如果是 override.stop_calculation:
       → 设置 outcome → break

  if waiting_review: break（等待人工恢复）

状态: running → completed（或 waiting_review / failed）
```

### 流程十二：人工审核暂停与恢复

```
暂停:
  manual 规则触发
  → INSERT manual_review_task (calculation_task_id, target_type='executable_rule',
      target_id=rule_id, question, suggested_decision)
  → UPDATE calculation_tasks SET status='waiting_review',
      checkpoint={ stage, rule_id, completed_step_ids, current_scores }
  → 前端显示"等待审核" + 审核任务详情

审核人处理:
  审核任务页面: 展示问题、AI建议、涉及的规则和材料
  → 审核人填写 decision + review_comment
  → 可选: resolved（接受）/ escalated（升级）

恢复:
  POST /api/v2/calculations/:id/resume
  → 读取 checkpoint
  → 验证: input_snapshot_hash 未变化（材料未被重新识别）
      规则集未被修改（rule_set still published, same version）
  → status → resuming
  → 从 checkpoint.stage 恢复
  → 跳过已完成步骤（通过 execution_key 查重，幂等）
  → 被 manual 规则阻塞的步骤重新尝试执行（读取 decision）
  → 继续后续阶段

幂等保证:
  每个 execution_key 只执行一次
  → 恢复时检查 execution_key 是否已存在
  → 已存在 → 跳过，复用之前结果
```

### 流程十三：结果输出与解释

```
计算完成后:
  calculation_metric_results:
    每个指标一行: raw_score / adjusted_score / final_score / status / explanation
  calculation_rule_results:
    每条规则一行: matched / executed / score_change / exec_status
  calculation_steps:
    完整执行轨迹

前端展示:
  ┌──────────────────────────────────────┐
  │ 总分: 78.50                         │
  │                                      │
  │ 德育: 18/20  ██████████░░            │
  │   荣誉称号 +5（全国优秀共青团员）      │
  │   志愿服务 +10（40小时）              │
  │   同类择高: 省级被排除                │
  │   上限: 未触发                        │
  │                                      │
  │ 智育: 25/30  ████████████░░          │
  │   ...                                │
  │                                      │
  │ 被排除项目:                           │
  │   - 省级优秀学生（与国家级同组择高）   │
  │                                      │
  │ 人工审核决定:                         │
  │   - 数学建模竞赛: 认定为教育主管部门   │
  │                                      │
  │ ⚠️ 证据不足: 1 项（社会实践证明模糊）  │
  └──────────────────────────────────────┘

追溯链:
  每条加分 → 点击 → 展开:
    原始材料 → 提取事实 → 标准化过程 → 匹配规则
    → 规则原文位置（第X页第Y段）
```

### 流程十四：重新计算和历史追溯

```
触发条件:
  - 材料重新识别（新 analysis_run）
  - 规则发布新版本（新 rule_set）
  - 人工审核决定变化

处理:
  → 创建新的 calculation_task（不覆盖旧任务）
  → 关联新 rule_set 版本或新 analysis_run
  → 完全重新执行（新的 execution_key）
  → 旧任务保留，可查询

历史追溯:
  GET /api/v2/calculations/:id
  → 返回:
      - 当时使用的 rule_set（通过 rule_set_id 关联，规则已冻结不可变）
      - 当时使用的 analysis_run（通过 input_snapshot_hash 关联）
      - 完整 calculation_steps
      - 完整 calculation_rule_results
      - 完整 calculation_metric_results
      - 当时的 manual_review_tasks + decisions
```

---

## 十二、数据流总图

```
规则路径:
  upload → source_document → doc_blocks
  → indicator_nodes → rule_packages
  → executable_rules + dependencies + exclusions
  → consistency_check → publish (freeze)

材料路径:
  upload → attachments → analysis_run → extracted_facts
  → material_match → candidates

计算路径:
  create_task (lock rule_set + analysis_run)
  → scoring_engine (8 stages, per exec_rule)
  → metric_results + rule_results + steps
  → [waiting_review → resume] → completed
  → output (scores + trace + explanation)

历史路径:
  new analysis → new task (not overwrite)
  new rule_set → new task (not overwrite)
  old task → always accessible (frozen rule_set + frozen facts)
```

---

## 十三、预计新增/修改文件

### 新建

```
server/src/services/zongce/db/init_v2.sql
server/src/services/zongce/db/migrate_v2.js
server/src/services/zongce/engine/scoringEngine.js
server/src/services/zongce/engine/executors/  (11个执行器)
server/src/services/zongce/engine/formulaEngine.js
server/src/services/zongce/engine/consistencyChecker.js
server/src/services/zongce/engine/freezeService.js
server/src/controllers/zongce/ruleSetController.js
server/src/controllers/zongce/scoringController.js
client/src/views/zongce/RuleSetView.vue
client/src/views/zongce/ScoreResult.vue
```

### 修改

```
promptTemplates.js — 分步 Prompt
schemas.js — 新规则类型 Schema
ruleParser.js — 调用分步解析链
database.js — 执行 init_v2.sql
SmartFillRule.vue — 规则摘要页
SmartFillScore.vue — 接入真实结果
```
