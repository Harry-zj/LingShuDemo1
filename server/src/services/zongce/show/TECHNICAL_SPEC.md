# 灵枢智能填表 — 技术规格文档

> 版本：v2.3 | 日期：2026-07-11 | 作者：陈灵湘

---

## 目录

1. [系统概览](#1-系统概览)
2. [数据库架构](#2-数据库架构)
3. [规则解析管线](#3-规则解析管线)
4. [材料识别与匹配管线](#4-材料识别与匹配管线)
5. [序列化层](#5-序列化层)
6. [评分引擎](#6-评分引擎)
7. [API 路由](#7-api-路由)
8. [前端交互流程](#8-前端交互流程)

---

## 1. 系统概览

```
┌──────────────────────────────────────────────────────────────┐
│                     灵枢智能填表系统                           │
│                                                              │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │ 规则解析  │───▶│  材料识别匹配  │───▶│     评分计算      │   │
│  │ (Phase 0) │    │ (Phase 1-3)  │    │   (Step D)       │   │
│  └──────────┘    └──────────────┘    └──────────────────┘   │
│       │                │                      │              │
│       ▼                ▼                      ▼              │
│  ┌──────────┐    ┌──────────────┐    ┌──────────────────┐   │
│  │ DOCX解析  │    │  OCR+事实提取 │    │  确定性规则执行    │   │
│  │ AI结构化  │    │  AI规则匹配   │    │  dedup/cap/聚合   │   │
│  │ 查分表编译 │    │  确定性查表    │    │                  │   │
│  └──────────┘    └──────────────┘    └──────────────────┘   │
└──────────────────────────────────────────────────────────────┘
```

**三个核心阶段：**

| 阶段 | 输入 | 处理 | 输出 |
|------|------|------|------|
| **规则解析** | Word 规则文档 | DOCX 结构提取 → AI 分层解析 → 编译查分表 | `indicator_nodes` + `rule_packages` + `executable_rules` + `lookup_tables` |
| **材料识别匹配** | 证书/证明图片/PDF/DOCX | OCR → AI 事实提取 → AI 规则匹配 → 确定性查分表 | `extracted_facts` + `fact_rule_matches` + 分数预览 |
| **评分计算** | 已确认的事实+匹配 | 按 execution_stage 排序执行规则：eligibility → base_score → dedup → cap → aggregation | `calculation_rule_results` + 各维度分数 |

---

## 2. 数据库架构

### 2.1 核心表关系图

```
rule_sets (规则集)
  ├── rule_set_documents (关联文档)
  │     └── rule_sources (原始文档)
  │           └── doc_blocks (文档结构块)
  ├── indicator_nodes (指标树，如 F1→F1.1→F1.1.1)
  │     └── rule_packages (规则包，聚合一组规则)
  │           └── executable_rules (可执行规则)
  ├── lookup_tables (查分表)
  │     ├── lookup_dimensions (维度定义)
  │     └── lookup_cells (查分单元格)
  └── rule_source_refs (溯源引用)

materials (材料)
  ├── attachments (附件：图片/PDF/DOCX)
  ├── material_analysis_runs (分析运行记录)
  │     └── extracted_facts (提取的结构化事实)
  │           ├── extracted_fact_sources (事实来源)
  │           └── fact_rule_matches (事实-规则匹配)
  │                 └── rule_match_runs (匹配运行记录)
  └── material_recognitions (旧版识别缓存，已脱离主链路)

calculation_tasks (计算任务)
  ├── calculation_task_inputs (任务输入)
  ├── calculation_rule_applications (规则应用编排)
  ├── calculation_rule_results (规则执行结果)
  ├── calculation_metric_results (指标汇总)
  └── calculation_steps (执行步骤日志)
```

### 2.2 关键枚举

**executable_rules.rule_type**：`fixed` | `per_unit` | `tiered` | `lookup` | `formula_ast` | `coefficient` | `cap` | `dedup` | `eligibility` | `manual` | `normalization` | `evidence_policy` | `override` | `outcome_constraint`

**executable_rules.execution_stage**：`precheck` → `normalization` → `eligibility` → `base_score` → `adjustment` → `override` → `deduplication` → `cap` → `aggregation` → `post_aggregation` → `outcome`

**fact_rule_matches.match_condition**：`pass` | `fail` | `uncertain`

**fact_rule_matches.review_status**：`pending` | `confirmed` | `rejected`

---

## 3. 规则解析管线

### 3.1 入口

```
POST /api/zongce/rules/upload    → ruleController.uploadRuleFiles
POST /api/zongce/rule-sets/:id/documents → ruleSetController.addDocument
POST /api/zongce/rule-sets/:id/publish   → ruleSetController.publishRuleSet
```

### 3.2 流程详解

```
Step 0: 文档上传
  User 上传 Word 文档
    → 保存到 rule_sources (file_path → server/uploads/)
    → 创建 rule_set（如果不存在）
    → rule_set_documents 建立关联

Step 1: DOCX 结构提取 (docStructure.js)
  入口: extractStructure(filePath)
    → mammoth 转 HTML
    → 内建 OOXML styles.xml 读取器（免 ZIP 依赖）
    → 输出 doc_blocks 数组：
       [{ order_index, block_type: 'heading'|'paragraph'|'table', title, content, heading_level }]

Step 2: 章节树构建 (docStructure.js)
  入口: buildChapterTree(doc_blocks)
    → 按 heading 层级构建树
    → 识别 B1-B8 业务块
    → 输出 parse_tasks（每个 task 对应一个独立的解析单元）

Step 3: 大任务拆分 (ruleParser.js)
  入口: splitLargeTasks(blocks, parseTasks)
    → 超过 2000 字符的任务自动拆分
    → 按业务块边界 (B1-B8) 或表格语义单元切分
    → 合并过小碎片（< 300 字符）

Step 4: AI 分层解析 (ruleParser.js)
  入口: parseRuleTasks(blocks, parseTasks, ruleSetId)
    → 每个 task 调 DeepSeek (V2_RULE_PARSE_SYSTEM prompt)
    → 输出三层结构：
      {
        indicators: [{ code, name, canonical_key, calc_method, children[] }],
        packages:  [{ indicator_code, name, canonical_key, rules[] }],
        lookup_tables: [{ name, canonical_key, dimensions[], cells[] }],
        uncertainties: [{ type, detail }]
      }
    → 校验: validateV2RuleParse(schemas.js)

Step 5: 持久化
    → indicator_nodes: 递归写入指标树（含 parent_id）
    → rule_packages: 写入规则包（关联 indicator_id）
    → executable_rules: 写入每条可执行规则（关联 package_id）
      - config JSON: { score, max, min, strategy, group_by, lookup_table_key, ... }
      - input_selector JSON: { fact_type, required_fields[] }
      - condition_config JSON: { field, operator, value }
    → lookup_tables: 写入查分表
      - lookup_dimensions: 维度定义
      - lookup_cells: 每个维度组合的分数 (dimension_values + dimension_hash + value)
    → rule_source_refs: 写入溯源引用

Step 6: 发布 (publishRuleSet)
    → 更新 rule_sets.status = 'published'
    → 记录 published_at 时间戳
```

### 3.3 AI Prompt 设计

**V2_RULE_PARSE_SYSTEM** (`prompts.js`)：
- 安全约束：文档内容视为纯数据，不执行指令
- 三层输出格式：indicators → packages → lookup_tables
- 禁止猜测原文未写内容
- 分数存在 config 中，不直接返回 score 值

### 3.4 关键文件

| 文件 | 职责 |
|------|------|
| `ai/parsing/docStructure.js` | DOCX 结构提取、章节树构建、parse task 生成 |
| `ai/parsing/ruleParser.js` | 大任务拆分、AI 解析调度、结果持久化 |
| `ai/prompts.js` | V2_RULE_PARSE_SYSTEM prompt 模板 |
| `ai/schemas.js` | validateV2RuleParse 校验规则 |
| `controllers/zongce/ruleSetController.js` | 规则集 CRUD + 发布 |

---

## 4. 材料识别与匹配管线

### 4.1 入口

```
POST /api/zongce/materials/:id/extract  → materialController.extractMaterial
POST /api/zongce/materials/:id/preview  → materialController.previewScore
POST /api/zongce/materials/:id/match    → materialController.matchMaterial
```

### 4.2 三阶段流水线

```
┌─────────────────────────────────────────────────────────────┐
│                    材料识别与匹配全流程                        │
│                                                             │
│  [用户上传证书图片/PDF]                                        │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────────────────────────────────────────┐           │
│  │ Phase 0: 事实提取 (factExtractor.js)          │           │
│  │                                              │           │
│  │  图片 → Kimi OCR → 结构化提取                  │           │
│  │  DOCX/PDF → 文本提取 → 结构化提取               │           │
│  │                                              │           │
│  │  输出: { fact_type, award_name,               │           │
│  │          competition_name, award_rank,        │           │
│  │          inferred_level, organizer,           │           │
│  │          suggested_rule_block, ... }          │           │
│  └────────────────────┬─────────────────────────┘           │
│                       │                                     │
│                       ▼                                     │
│  ┌──────────────────────────────────────────────┐           │
│  │ Phase 1+2: AI 规则匹配 (ruleBlockMatcher.js)  │           │
│  │                                              │           │
│  │  Phase 1: 规则卡片选择                         │           │
│  │    输入: fact + rule block cards              │           │
│  │    输出: top-3 候选 indicator_ids             │           │
│  │    (DeepSeek, ~1s)                           │           │
│  │                                              │           │
│  │  Phase 2: 精确匹配+字段归一化                   │           │
│  │    输入: fact + 完整规则上下文 + 维度枚举       │           │
│  │    输出: selected_indicator_id,               │           │
│  │          matched_rule_ids,                    │           │
│  │          score_dimensions,                    │           │
│  │          matched_lookup_table_id,             │           │
│  │          normalized_fields                    │           │
│  │    (DeepSeek, ~3-5s)                         │           │
│  └────────────────────┬─────────────────────────┘           │
│                       │                                     │
│                       ▼                                     │
│  ┌──────────────────────────────────────────────┐           │
│  │ Phase 3: 确定性查表算分 (materialPipeline.js)  │           │
│  │                                              │           │
│  │  1. 解析 indicator code (B2 → 查 indicator)   │           │
│  │  2. 加载 lookup_table (Kimi指定 或 回退关联)   │           │
│  │  3. 维度映射: Kimi维度名 → DB维度名             │           │
│  │     - 学院默认政策 (college_default_policy)    │           │
│  │     - table alias 枚举映射                    │           │
│  │  4. 四遍查表匹配:                              │           │
│  │     Pass 1: Raw hash 精确匹配                 │           │
│  │     Pass 2: Normalized hash 归一化匹配        │           │
│  │     Pass 3: Fuzzy 模糊匹配                    │           │
│  │     Pass 4: Wildcard 通配符匹配 (*)            │           │
│  │  5. 一致性校验: rule-indicator 同分支检查       │           │
│  │                                              │           │
│  │  输出: { score_preview, indicator,            │           │
│  │          matched_rule, lookup_table,          │           │
│  │          lookup_dimensions, error_type }      │           │
│  └────────────────────┬─────────────────────────┘           │
│                       │                                     │
│                       ▼                                     │
│  ┌──────────────────────────────────────────────┐           │
│  │ 即时持久化: validateAndPersistMatch()          │           │
│  │                                              │           │
│  │  1. 创建 rule_match_run                      │           │
│  │  2. 失效旧 is_current=1 的 match              │           │
│  │  3. 确定性验证 10 项检查:                      │           │
│  │     - fact-material 关系                     │           │
│  │     - rule_set 已发布                        │           │
│  │     - indicator 属于 rule_set                │           │
│  │     - rules 属于 rule_set                    │           │
│  │     - fact_type 兼容                         │           │
│  │     - required_fields 满足                   │           │
│  │     - dimensions 已归一化                     │           │
│  │     - lookup_table 属于 rule                 │           │
│  │     - score 来自 lookup (非AI返回值)           │           │
│  │     - 无 consistency_conflict                │           │
│  │  4. 写入 fact_rule_matches                   │           │
│  │     - preview_data JSON: { score_preview,     │           │
│  │       score_status, indicator, rule,         │           │
│  │       lookup_table, lookup_dimensions,       │           │
│  │       error_type, dimension_status }         │           │
│  │  5. 回读 fact_rule_match_id → 前端 match 对象 │           │
│  └──────────────────────────────────────────────┘           │
│                                                             │
│  [用户审核分数 → 确认/修改 → 重新 preview → 确认]               │
│       │                                                     │
│       ▼                                                     │
│  ┌──────────────────────────────────────────────┐           │
│  │ 确认: matchMaterial()                          │           │
│  │                                              │           │
│  │  1. 校验 match 存在、属于该 material            │           │
│  │  2. 幂等: 已确认直接返回                        │           │
│  │  3. 事务: UPDATE fact_rule_matches             │           │
│  │           UPDATE extracted_facts               │           │
│  │  4. 回读 serialized fact → 前端更新             │           │
│  └──────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────┘
```

### 4.3 幂等与缓存

```
extractMaterial 幂等逻辑:
  1. 优先检查 material_analysis_runs (status=completed/needs_review)
     → 有: 读 extracted_facts → serializeFact → 返回
  2. 不再回退到 material_recognitions.raw_ai_response (已脱离主链路)
  3. force=true 参数可跳过缓存，重新提取

previewScore 缓存:
  - preview_cache 写入 material_recognitions.raw_ai_response
  - key: fact_key (fact_id 或内容 hash)
  - 包含: score_preview, score_status, indicator, rule, lookup_table, fact_hash
  - 刷新页面后 serializeFact 回退读取此缓存
```

### 4.4 关键文件

| 文件 | 职责 |
|------|------|
| `ai/factExtractor.js` | `extractFacts` (旧版) + `extractStructuredFacts` (新版)：OCR + AI 事实提取 |
| `ai/ruleBlockMatcher.js` | `buildRuleBlockCards` + `selectRuleBlocksWithKimi` (P1) + `matchFactWithContext` (P2) + `validateAndPersistMatch` |
| `ai/materialPipeline.js` | `calculateScorePreview` (Phase 3)：维度映射 + 四遍查表 + 回退策略 |
| `ai/deepseek.js` | `chatStreamJson` (流式JSON提取) + `ocrWithKimi` (图片OCR) |
| `ai/prompts.js` | `MATERIAL_EXTRACT_SYSTEM` + `FACT_EXTRACT_SYSTEM` + `RULE_MATCH_SYSTEM` + `RULE_BLOCK_SELECTION_SYSTEM` |
| `controllers/zongce/materialController.js` | `extractMaterial` + `previewScore` + `matchMaterial` |

### 4.5 match 对象的 score_status 状态机

```
                     ┌──────────┐
                     │  pending  │ (初始，doPreview 调用前)
                     └─────┬────┘
                           │
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │confirmed │ │candidate │ │ lookup   │
        │  (绿色)   │ │_pending  │ │_failed   │
        │          │ │_review   │ │ (红色)    │
        └────┬─────┘ └────┬─────┘ └──────────┘
             │            │
             │ 用户确认    │ 用户修改字段
             ▼            │ → 重新 doPreview
        ┌──────────┐      │ → 可能变为 confirmed
        │confirmed │      │
        │ (已确认)  │◄─────┘
        └──────────┘
```

---

## 5. 序列化层

### 5.1 设计原则

所有 API 返回统一的 fact/match 结构，无论从哪个入口（getMaterials、extractMaterial、matchMaterial）获取。

### 5.2 serializeFact(efRow)

```javascript
// 输入: extracted_facts 表的一行
// 输出:
{
  fact_id: 27,                 // DB 主键 (整数)
  legacy_fact_key: 'f1',       // AI 原始 fact_id (字符串)
  fact_type: 'award',
  fact_data: {                 // 嵌套的 JSON 对象
    inferred_level: 'college',
    award_name: '二等奖',
    competition_name: '...',
    suggested_rule_block: 'B2',
    // ... 所有 AI 提取的字段
  },
  review_status: 'pending',    // pending | confirmed
  match: {                     // 关联的匹配结果 (null 如果未匹配)
    fact_rule_match_id: 42,   // 确认时使用
    score_preview: 5,          // 预览分数
    score_status: 'confirmed', // confirmed | candidate_pending_review | lookup_failed
    indicator: { code: 'F3.1', name: '文体竞赛' },
    rule: { name: '...', rule_type: 'lookup' },
    lookup_table: { id: 16, name: '文体竞赛加分标准' },
    raw_dimensions: { level: 'college', rank: 'encouragement' },
    review_status: 'pending',  // pending | confirmed
    error_type: null,
  },
  sources: [{ attachment_id, source_text, source_locator }],
}
```

### 5.3 serializeMaterial(mat)

- 加载最新的 `material_analysis_run`
- 读取所有 `extracted_facts` → 逐个 `serializeFact`
- 计算 `preview_summary`: confirmed_score, candidate_score, scored_fact_count, candidate_fact_count 等
- 返回完整材料对象

### 5.4 preview_summary 计算逻辑

```javascript
preview_summary = {
  confirmed_score:      sum(match.score_preview)  // review_status != 'pending'
  candidate_score:      sum(match.score_preview)  // review_status == 'pending'
  scored_fact_count:    已确认的事实数
  candidate_fact_count: 待确认的事实数
  pending_fact_count:   无分数且无错误的事实数
  failed_fact_count:    有错误的事实数
  total_fact_count:     总事实数
}
```

---

## 6. 评分引擎

### 6.1 执行阶段

```javascript
const STAGES = [
  "precheck",        // 事前校验
  "normalization",   // 字段归一化
  "eligibility",     // 资格检查
  "base_score",      // 基础计分
  "adjustment",      // 调整
  "deduplication",   // 去重
  "cap",             // 封顶
  "aggregation",     // 聚合
  "post_aggregation",// 聚合后处理
  "outcome",         // 最终输出
];
```

### 6.2 执行流程

```
executeCalculation(taskId)
  → 加载 rule_set 的 executable_rules
  → 加载 material_analysis_runs → extracted_facts
  → 按 execution_stage 排序执行
  → 每个 stage:
      → 过滤该阶段的 rules
      → auto_level='manual_required' → 加入阻塞审核列表
      → 其他规则 → executeRule(rule, ctx)
      → 写入 calculation_rule_results
      → 写入 calculation_steps
  → 阻塞审核: 创建 manual_review_tasks → 状态='waiting_review'
  → 全部通过: aggregateResults → 汇总各维度分数
  → 完成: total_score → calculation_tasks.status='completed'
```

### 6.3 支持 V2 计算

```
POST /api/zongce/evaluation/calculate  → evaluationController.calculateScore
  参数: { rule_set_id, material_ids[] }
  → 锁定 material_analysis_runs
  → 创建 calculation_task
  → 执行 executeCalculation(taskId)
  → 返回: { task_id, status, total_score }
```

---

## 7. API 路由

### 7.1 规则管理

| 方法 | 路由 | 功能 |
|------|------|------|
| POST | `/api/zongce/rules/upload` | 上传规则文件 |
| POST | `/api/zongce/rules/text` | 输入规则文字 |
| GET | `/api/zongce/rules/sources` | 获取规则来源列表 |
| POST | `/api/zongce/rules/sources/:id/parse` | 解析单个规则源 |
| DELETE | `/api/zongce/rules/sources/:id` | 删除规则来源 |

### 7.2 规则集

| 方法 | 路由 | 功能 |
|------|------|------|
| POST | `/api/zongce/rule-sets` | 创建规则集 |
| GET | `/api/zongce/rule-sets` | 获取规则集列表（含统计） |
| GET | `/api/zongce/rule-sets/:id` | 获取规则集详情（含嵌套结构） |
| POST | `/api/zongce/rule-sets/:id/documents` | 添加文档到规则集 |
| DELETE | `/api/zongce/rule-sets/:id/documents/:docId` | 移除文档 |
| POST | `/api/zongce/rule-sets/:id/publish` | 发布规则集 |
| DELETE | `/api/zongce/rule-sets/:id` | 删除规则集 |
| POST | `/api/zongce/rule-sets/:id/clone` | 克隆规则集 |

### 7.3 材料管理

| 方法 | 路由 | 功能 |
|------|------|------|
| POST | `/api/zongce/materials` | 创建材料项 |
| GET | `/api/zongce/materials` | 获取材料列表（含序列化 facts） |
| POST | `/api/zongce/materials/:id/upload` | 上传证明附件 |
| POST | `/api/zongce/materials/:id/extract` | AI 提取事实（幂等） |
| POST | `/api/zongce/materials/:id/preview` | 规则匹配 + 分数预览 |
| POST | `/api/zongce/materials/:id/match` | 确认单条匹配 |
| DELETE | `/api/zongce/materials/:id` | 删除材料 |
| DELETE | `/api/zongce/materials/:matId/attachments/:attId` | 删除单个附件 |

### 7.4 评分计算

| 方法 | 路由 | 功能 |
|------|------|------|
| POST | `/api/zongce/evaluation/calculate` | 创建并执行计算任务 |
| GET | `/api/zongce/evaluation/result` | 获取最新评估结果 |
| GET | `/api/zongce/calculations/:id` | 获取计算任务详情 |
| POST | `/api/zongce/calculations/:id/resume` | 恢复暂停的计算 |

---

## 8. 前端交互流程

### 8.1 组件树

```
SmartFill.vue (主页面)
  ├── SmartFillRule.vue (规则管理)
  │     └── 上传文件 / 输入文本 / 查看解析结果
  ├── SmartFillMaterial.vue (材料识别)
  │     └── 新建材料 → 上传附件 → AI识别 → 审核确认
  ├── SmartFillScore.vue (评分清单)
  │     └── 查看各维度分数明细
  └── SmartFillForm.vue (自动填表)
        └── 上传模板 → AI填充 → 下载
```

### 8.2 材料识别交互流程

```
[1] 用户点击 "新建材料项"
      → createMaterial() → POST /api/zongce/materials
      → 空材料出现在列表

[2] 用户点击 "上传证明"
      → 选择图片/PDF/DOCX 文件
      → uploadFiles(materialId, files) → POST /api/zongce/materials/:id/upload
      → refreshMaterials() → GET /api/zongce/materials
      → 附件出现在材料下

[3] 用户点击 "AI 识别"
      → doExtract(mat)
        → extractingIds.add(mat.id)  [按钮显示"识别中..."]
        → extractMaterial(mat.id) → POST /api/zongce/materials/:id/extract
          → 后端: 幂等检查 → OCR → AI事实提取 → 写DB → serializeFact → 返回
        → mat.facts = serialized facts
        → for each fact: doPreview(mat, fact)  [逐个匹配规则]
          → previewingKeys.add(factKey)
          → previewScore(mat.id, { fact: fd }) → POST /api/zongce/materials/:id/preview
            → 后端: Phase 1+2 AI匹配 + Phase 3 查表 + persist match
          → fact.match = response.match
          → previewingKeys.delete(factKey)
        → extractingIds.delete(mat.id)
      → UI 更新: 显示事实列表 + 匹配结果 + 分数

      [进度提示]
        Header: "⏳ 正在匹配规则 2/5..."
        单条:  "⏳ 正在匹配规则…" → 完成后显示分数/指标

[4] 用户审核每条事实
      → 编辑字段 (级别/等级/主办单位等)
        → @change → doPreview(mat, fact)  [重新匹配]
      → 查看匹配结果:
        - 指标 (F3.1 文体竞赛)
        - 规则 (lookup 类型)
        - 查分表 (文体竞赛加分标准)
        - 维度 (level=college, rank=encouragement)
        - 分数 (+2)

[5] 用户点击 "确认该条"（仅 score_status='confirmed' 时显示）
      → confirmMatch(mat.id, fact)
        → matchMaterial(matId, { fact_rule_match_id, extracted_fact_id })
          → POST /api/zongce/materials/:id/match
          → 后端: 校验 → UPDATE fact_rule_matches + extracted_facts → 回读serialized fact
        → fact.match = res.data.fact.match  [只更新 match，不碰 fact_data]
        → recalcPreviewSummary(mat)  [原地修改 preview_summary，保证响应式]
        → collapsedMap[matId] = allConfirmed(mat)  [全部确认才收起]
      → UI 更新: badge "已确认" (绿) + tag 从 "+5待确认" → "+5" (绿)

[6] 全部确认完成
      → statusLabel(mat): "已入库"
      → 材料卡片自动折叠
```

### 8.3 响应式更新注意事项

```
关键修复点:
  1. recalcPreviewSummary 使用 Object.assign(mat.preview_summary, {...})
     原地修改已有对象，Vue Proxy 能逐个捕获属性变更
     ✗ mat.preview_summary = {...}  → 替换对象，可能丢失追踪

  2. confirmMatch 只更新 fact.match + fact.review_status
     不替换 fact_data 对象引用
     ✗ Object.assign(fact, res.data.fact) → 替换 fact_data → v-model 检测变化
       → @change → doPreview → 覆盖确认结果

  3. collapsedMap[matId] = allConfirmed(mat)
     只有全部事实确认后才自动折叠
     ✗ collapsedMap[matId] = true → 确认一条就收起
```

---

## 附录 A：AI 模型使用

| 场景 | 模型 | 说明 |
|------|------|------|
| 图片 OCR | Kimi (vision) | 证书/证明图片文字提取 |
| 事实提取 | DeepSeek | 从OCR文本中提取结构化事实 |
| 规则解析 | DeepSeek | V2_RULE_PARSE_SYSTEM 分层解析 |
| 规则块选择 | DeepSeek | Phase 1: 从卡片中选择 top-3 候选 |
| 精确匹配 | DeepSeek | Phase 2: 字段归一化 + 维度映射 |
| 查表算分 | 无 (确定性) | Phase 3: DB hash/fuzzy/wildcard 匹配 |

## 附录 B：环境变量

```
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=135246
DEEPSEEK_API_KEY=xxx
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
KIMI_API_KEY=xxx
KIMI_BASE_URL=https://api.moonshot.cn
KIMI_MODEL=moonshot-v1-8k-vision
```

## 附录 C：运行命令

```bash
# 启动
npm run dev

# 数据库自动初始化（首次启动自动建库建表）
# 检查 F3 规则范围
node check_f3.js
```
