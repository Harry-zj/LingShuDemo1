# 灵枢综测计算功能 — 完整技术文档

> 编写日期：2026-07-11
> 范围：规则解析 → 发布 → 材料识别 → 规则匹配 → 计分预览 → 确认入库 → 评分计算
> 聚焦：综测计算（评分）全链路，从数据生产到最终引擎执行

---

## 一、系统总览

灵枢综测计算系统的核心任务是将**学生上传的证明材料**与**学校发布的综测规则**进行匹配，计算出一个确定性的分数。整个链路分为四个大阶段：

```
┌─────────────────────────────────────────────────────────────────┐
│  阶段 0：规则准备                                               │
│  DOCX上传 → 结构提取 → AI解析 → 指标树/规则包/可执行规则/查分表  │
├─────────────────────────────────────────────────────────────────┤
│  阶段 1：材料识别                                               │
│  图片/文档上传 → Kimi OCR → DeepSeek 事实提取 → 结构化事实       │
├─────────────────────────────────────────────────────────────────┤
│  阶段 2：规则匹配 + 分数预览                                     │
│  构建规则卡片 → Phase1选候选块 → Phase2精确匹配 → 查分表算分     │
├─────────────────────────────────────────────────────────────────┤
│  阶段 3：评分计算  ❌ 数据断链                                   │
│  加载可执行规则 + 事实 → 10阶段执行 → 维度聚合 → 总分            │
└─────────────────────────────────────────────────────────────────┘
```

阶段 0 和阶段 1 产生数据，阶段 2 做单条事实的即时匹配+预览，阶段 3 做最终批量确定性的评分计算。当前阶段 0~2 已跑通，阶段 3 引擎代码就绪但上游数据断链。

---

## 二、阶段 0：规则准备（数据基础）

### 2.1 触发路径

```
SmartFillRule.vue: onFiles()
  → api.uploadRuleFiles(formData)           POST /api/zongce/rules/upload
  → ruleController.uploadRuleFiles
    → INSERT rule_sources (status='pending')
  → emit('refresh') → SmartFill.refreshRules()
    → api.getRuleSources() + api.getRuleSets()

用户点击"🔍 解析"
  → SmartFillRule.doParse(sourceId)
    → api.parseRuleSource(sourceId)         POST /api/zongce/rules/sources/:id/parse
    → ruleController.parseRuleSource
      → INSERT ai_tasks (status='processing')
      → runParseV2InBackground(taskId, sourceId, userId)  // 异步后台
      → SSE stream 推送进度
```

### 2.2 后台解析主流程

文件：`server/src/services/zongce/ai/parsing/ruleParser.js` → `parseRuleSourceV2()`

```
DOCX 文件
  │
  ├─ Step 1: extractStructure(filePath)          → docStructure.js
  │   mammoth HTML 转换 → parseHtml() → doc_blocks[]
  │   每个 block: { block_type, title, content, structured_content, order_index, style_info, structure_confidence }
  │
  ├─ Step 2: buildChapterTree(blocks)            → docStructure.js
  │   遍历 heading/paragraph blocks → 识别顶层章（Heading1 或 "第X章" 文本模式）
  │   排除："第X条"、"表N"、"注："、"说明："、"B1-B8"
  │   章节内 section：Heading 2-6 / 编号子标题 / B1-B8
  │   返回 chapters[{ id, title, block_start, block_end, sections[] }]
  │
  ├─ Step 3: buildParseTasks(blocks, chapters)   → docStructure.js
  │   每个 section → 一个解析任务
  │   无 section 的 chapter → 整章一个任务
  │   返回 parseTasks[{ chapter_id, section_id, block_start, block_end }]
  │
  ├─ Step 3.6: splitLargeTasks(blocks, tasks)    → ruleParser.js
  │   大任务拆分阈值: TASK_CHAR_THRESHOLD = 2000 字符
  │   检测业务块边界 (B1-B8, C1 等) → 按业务块拆
  │   无业务块 → 按表格语义单元拆（表格标题+表格+表后注释不分离）
  │
  ├─ Step 4: 并行 AI 解析 (每批 6 个, DeepSeek)
  │   每个 task 调用 chatStreamJson(DeepSeek)
  │     System: V2_RULE_PARSE_SYSTEM
  │     User: task 范围内的 block 文本
  │     maxTokens: 8192
  │   失败 task 重试 1 次（瞬时错误），JSON 截断不重试
  │
  ├─ Step 5: 合并去重 mergeAndDedupResults()
  │   indicators: 按 canonical_key 去重，递归合并子节点
  │   packages: 按 canonical_key 去重，rule 合并（同名追加，非同名的 config 取更完整者）
  │   lookup_tables: 按 canonical_key/name 去重后追加
  │
  ├─ Step 6: 清洗 + 校验
  │   清洗: auto_level → sanitize, rule_type reference→lookup, sum→fixed
  │         calc_method → sanitizeCalcMethod (sum→sum_children, average→weighted_sum...)
  │   validateV2RuleParse(schemas.js): code/name/canonical_key 非空, rule_type/execution_stage 枚举校验
  │   validateMergedResult(): 别名解析 + parent_code引用校验 + 重复key校验
  │
  └─ Step 7: 事务写入
      BEGIN TRANSACTION
        INSERT indicator_nodes (递归父子关系)
        INSERT rule_packages (关联 indicator_id)
        INSERT executable_rules (config/input_selector/condition/scope/execution_stage)
        INSERT lookup_tables → lookup_dimensions → lookup_cells (含 dimension_hash)
        UPDATE rule_sources.status = 'parsed'
      COMMIT / ROLLBACK
```

### 2.3 AI 解析输出格式

```json
{
  "indicators": [{
    "code": "F1", "name": "德育", "canonical_key": "moral",
    "parent_code": null, "calc_method": "sum_children",
    "weight": 0.2, "max_score": 20, "children": [...]
  }],
  "packages": [{
    "indicator_code": "F1.1", "name": "荣誉称号加分",
    "canonical_key": "moral.honor_title.scoring",
    "summary": "国家级+5/省级+3/校级+1，同类取最高",
    "auto_level": "automatic",
    "rules": [{
      "rule_type": "fixed", "name": "国家级+5分",
      "canonical_key": "moral.honor_title.scoring.national",
      "config": {"score": 5},
      "input_selector": {"fact_type": "award", "required_fields": ["level"]},
      "condition_config": {"field": "level", "operator": "==", "value": "national"},
      "application_scope": "per_fact",
      "execution_stage": "base_score",
      "priority": 0,
      "auto_level": "automatic"
    }, ...]
  }],
  "lookup_tables": [{
    "name": "竞赛加分查分表", "canonical_key": "lookup.competition",
    "dimensions": [
      {"dim_name": "level", "dim_label": "级别"},
      {"dim_name": "rank", "dim_label": "获奖等级"}
    ],
    "cells": [
      {"dimension_values": {"level": "national", "rank": "first"}, "value": 10},
      {"dimension_values": {"level": "national", "rank": "second"}, "value": 7}
    ]
  }],
  "uncertainties": [...]
}
```

### 2.4 写入的核心表

| 表 | 内容 | 用途 |
|----|------|------|
| `indicator_nodes` | 指标树（code/canonical_key/parent_id/calc_method/max_score） | 评分引擎的聚合维度 |
| `rule_packages` | 规则包，属于某个 indicator | 规则的组织单元 |
| `executable_rules` | 可执行规则（rule_type/config/execution_stage/application_scope/condition_config） | 评分引擎直接执行的对象 |
| `lookup_tables/dimensions/cells` | 查分表（维度+单元格+hash） | 材料匹配时的分数查找 |

### 2.5 规则发布

```
SmartFillRule.publishSet(rs)
  → api.publishRuleSet(rs.id)           POST /api/zongce/rule-sets/:id/publish
  → ruleSetController.publishRuleSet
    → UPDATE rule_sets SET status='published', published_at=NOW()
```

发布后规则集变为只读，后续的材料识别/匹配/评分都基于已发布的规则集。

---

## 三、阶段 1：材料识别（事实生产）

### 3.1 触发路径

```
SmartFillMaterial.vue
  → emit('create') → SmartFill.createMaterial()
    → api.createMaterial('')              POST /api/zongce/materials
    → INSERT materials

  → emit('upload', matId, files) → SmartFill.uploadFiles()
    → api.uploadAttachments(matId, fd)    POST /api/zongce/materials/:id/upload
    → INSERT attachments (file_name/file_path/file_type/file_size)

用户点击"🔍 AI 识别"
  → SmartFillMaterial.doExtract(mat)
    → api.extractMaterial(mat.id)         POST /api/zongce/materials/:id/extract
    → materialController.extractMaterial
      → extractStructuredFacts(attachments)
```

### 3.2 事实提取流程

文件：`server/src/services/zongce/ai/factExtractor.js` → `extractStructuredFacts()`

```
附件列表
  │
  ├─ 图片 (.png/.jpg/.jpeg/.gif/.bmp/.webp)
  │   Step A: ocrWithKimi(Kimi K2.6) → OCR 纯文本
  │   Step B: chatStreamJson(DeepSeek, MATERIAL_EXTRACT_SYSTEM) → 结构化事实
  │
  ├─ DOCX (.docx)
  │   mammoth.extractRawText() → 纯文本
  │   → chatStreamJson(DeepSeek, MATERIAL_EXTRACT_SYSTEM) → 结构化事实
  │
  └─ 其他 (.pdf / 纯文本)
      直接读取文本 → chatStreamJson(DeepSeek, MATERIAL_EXTRACT_SYSTEM) → 结构化事实

输出格式（每条 fact）:
{
  "fact_type": "award",
  "suggested_rule_block": "B2",
  "award_name": "二等奖",
  "competition_name": "ACM校队招新积分赛",
  "award_rank": "second",
  "organizer": "西南科技大学计算机科学与技术学院",
  "inferred_level": "college",
  "level_evidence": "落款为学院团委，无学校或省级单位印章",
  "award_date": "2023-12",
  "is_team": false,
  "my_role": null,
  "is_duplicate_project": false,
  "confidence": 0.9,
  "source_text": "..."
}
```

### 3.3 持久化

文件：`server/src/controllers/zongce/materialController.js` → `extractMaterial`

```
extractStructuredFacts 返回 { facts[], overall_clarity, needs_review }
  │
  ├─ INSERT/UPDATE material_recognitions
  │   写入 raw_ai_response (JSON blob):
  │   { extracted_facts: [...], overall_clarity, extracted_at: ISO时间 }
  │
  └─ UPDATE materials.title ← fact 中的 award_name/competition_name 拼接
```

**注意**：当前事实写入 `material_recognitions.raw_ai_response`（JSON blob），而非 V2 设计表 `extracted_facts`。这意味着：
- 刷新页面后事实可从 `raw_ai_response` 恢复（`getMaterials` 中反序列化到 `_extracted_facts`）
- 但 `extracted_facts` 表永远是空的
- 评分引擎 `executeCalculation` 读的是 `extracted_facts` 表 → **这是数据断链的核心原因之一**

---

## 四、阶段 2：规则匹配 + 分数预览（双阶段 Kimi 管线）

### 4.1 触发路径

```
SmartFillMaterial.doPreview(mat, fact)    ← fact 字段 @change 触发 / doExtract 后自动调用
  → api.previewScore(mat.id, { fact })    POST /api/zongce/materials/:id/preview
  → materialController.previewScore
    → matchFactPipeline(fact, ruleSetId)
    → calculateScorePreview(fact, ruleSetId, pipelineMeta)
```

### 4.2 匹配管线：matchFactPipeline

文件：`server/src/services/zongce/ai/ruleBlockMatcher.js`

```
┌──────────────────────────────────────────────────────────────┐
│ Phase 1: 构建规则卡片 + AI 选择 top-3 候选                     │
│                                                              │
│ buildRuleBlockCards(ruleSetId)                               │
│   从 DB 加载: indicators → packages → rules → lookups        │
│   为每个 indicator 生成一张卡片:                              │
│   { indicator_id, code, name, summary, classification_cues,  │
│     lookup_table_names, important_notes, exclusion_summary }  │
│                                                              │
│ selectRuleBlocksWithKimi(fact, cards)                        │
│   将事实 + 卡片发给 DeepSeek                                  │
│   System: RULE_BLOCK_SELECTION_SYSTEM                        │
│   返回: { candidates[{ indicator_id, code, confidence }],    │
│            needs_review, review_reason }                     │
│   → 最多 3 个候选，按置信度降序                               │
├──────────────────────────────────────────────────────────────┤
│ Phase 2: 加载上下文 + AI 精确匹配                             │
│                                                              │
│ loadRuleContext(ruleSetId, selectedIndicatorIds)             │
│   加载候选 indicator 的完整规则上下文:                        │
│   - packages + executable_rules (config/condition_config)    │
│   - lookup_tables + dimensions + sample_cells                │
│   - source_refs (doc_blocks 原文引用)                        │
│                                                              │
│ matchFactWithKimi(fact, ruleContexts)                        │
│   System: FACT_PRECISE_MATCH_SYSTEM                          │
│   返回: { selected_indicator_id, selected_rule_block,        │
│           matched_rule_ids, matched_lookup_table_id,         │
│           normalized_fields, score_dimensions, evidence[],   │
│           confidence, needs_review }                         │
│                                                              │
│ 最多两轮: 如果候选1 needs_review，尝试候选2                   │
└──────────────────────────────────────────────────────────────┘
```

### 4.3 分数计算：calculateScorePreview

文件：`server/src/services/zongce/ai/materialPipeline.js` → `calculateScorePreview()`

这是一个确定性的查表算分流程，不调 AI：

```
输入: fact + pipelineMeta = {
  selected_rule_block,    // "B7.2" → 提取父级 "B7"
  matched_rule_ids,
  matched_lookup_table_id, // Kimi 可直接指定表
  score_dimensions,        // {"level":"school","rank":"first"}
  normalized_fields
}

算分流程:
  │
  ├─ 0. 解析 selected_rule_block → 提取父级 code ("B7.2" → "B7")
  │
  ├─ 1. 查找 indicator: SELECT * FROM indicator_nodes WHERE code = parentBlock
  │
  ├─ 2. 如果 Kimi 指定了 matched_lookup_table_id:
  │     ├─ 校验表存在且属于当前 rule_set
  │     ├─ 加载表的实际维度名 (lookup_dimensions)
  │     ├─ 维度名映射: Kimi名称 → DB实际名称 (level/award_type/rank 归一化)
  │     │   枚举归一化: university→school, group→collective, first→first_prize ...
  │     ├─ 生成 dimension_hash: SHA256(JSON({dim_name: value}))
  │     ├─ 查 lookup_cells:
  │     │   精确 hash 匹配 → 取 value
  │     │   宽松匹配 → 逐 cell 比对 dimension_values
  │     └─ 一致性校验: 检查 Kimi 返回的 matched_rule_ids 是否与当前 indicator 同分支
  │         (沿 parent_id 链往上查 5 层，比较祖先是否重合)
  │
  ├─ 3. 如果 Kimi 没有指定表:
  │     回退到关联筛选: 遍历 indicator 关联的 packages → 找 lookup_tables
  │     用 score_dimensions 生成 hash 查 cell
  │
  └─ 4. 兜底: 表/维度/cell 任一未命中 → 返回 error_type + needs_review=true

返回: { score, matched_rule, matched_table_id, indicator_code, explanation,
        error_type, consistency_conflict, needs_review, _debug }
```

### 4.4 确认入库

```
SmartFillMaterial.doConfirm(mat)
  → api.matchMaterial(mat.id, { fact })   POST /api/zongce/materials/:id/match
  → materialController.matchMaterial
    → UPDATE material_recognitions SET
        category, explanation, confidence, matched_rule_ids,
        confirm_status = 'pending'
```

**注意**：确认只是 UPDATE `material_recognitions`，不写 `material_analysis_runs` 和 `extracted_facts`。阶段 3 评分引擎读不到数据。

---

## 五、阶段 3：评分计算（引擎就绪，数据断链）

### 5.1 当前调用路径（断裂版）

```
SmartFillScore.vue
  → emit('calculate')
  → SmartFill.calculateScore()
    → api.calculateScore()              ⚠ 无 body 参数！
    → POST /api/zongce/evaluation/calculate   body: {}
    → evaluationController.calculateScore
      → req.body.rule_set_id 为 undefined → "请选择规则集" ❌
```

即使前端传了参数，进入 controller 后：

```javascript
// evaluationController.calculateScore (当前代码)
const { rule_set_id, material_ids } = req.body;  // 需要前端传

// 验证规则集
SELECT * FROM rule_sets WHERE id = ? AND status = 'published'

// ❌ 关键断链：
for (const mid of material_ids) {
  SELECT id FROM material_analysis_runs
  WHERE material_id = ? AND status = 'completed'
  ORDER BY completed_at DESC LIMIT 1
  // ⚠ material_analysis_runs 表永远是空的！
  // 全代码库没有任何地方 INSERT 这张表
}
// → inputs 为空 → "没有可用的材料分析结果" ❌
```

### 5.2 material_analysis_runs 为什么是空的

这张 V2 设计表的职责是记录每次材料分析的版本快照（model/prompt_version/input_hash/output_hash）。但当前的材料事实提取流程（`extractMaterial`）直接把结果存到了 `material_recognitions.raw_ai_response`（JSON blob），跳过了 `material_analysis_runs` 和 `extracted_facts` 两张表。

### 5.3 前端 API 问题

`client/src/api/zongce.js`:
```javascript
// 当前实际调用的（无参版本）
export const calculateScore = () =>
  request.post("/zongce/evaluation/calculate");

// V2 版本（有正确参数签名，但无人调用）
export const calculateScoreV2 = (rule_set_id, material_ids) =>
  request.post("/zongce/evaluation/calculate", { rule_set_id, material_ids });
```

`SmartFill.vue` 调用的是无参版本。

### 5.4 评分引擎本身：executeCalculation

文件：`server/src/services/zongce/engine/scoringEngine.js`

引擎代码是完整的，包含 10 个执行阶段和 5 种执行器。只是因为上游数据断链，从未被真正触发过。

```
executeCalculation(taskId)
  │
  ├─ 加载任务: SELECT * FROM calculation_tasks WHERE id = ?
  ├─ 加载可执行规则: SELECT er.* FROM executable_rules
  │    JOIN rule_packages ON er.package_id = rp.id
  │    WHERE rp.rule_set_id = ? AND er.status = 'confirmed'
  │
  ├─ 加载材料事实: SELECT ef.* FROM extracted_facts ef    ⚠ 表为空
  │    WHERE ef.analysis_run_id IN (task inputs)
  │
  ├─ 加载指标: SELECT * FROM indicator_nodes WHERE rule_set_id = ?
  │
  └─ 10 阶段顺序执行:
      ┌──────────────┬──────────────────────────────────┐
      │ precheck     │ 预检查（规则依赖/冲突校验）        │
      │ normalization│ 数据归一化（level/type/rank 枚举） │
      │ eligibility  │ 资格筛选（排除不符合条件的事实）    │
      │ base_score   │ 基础加分（fixed/per_unit 规则）    │
      │ adjustment   │ 调整（coefficient/override）      │
      │ deduplication│ 去重（take_highest/group_by）     │
      │ cap          │ 封顶（max/min 限制）               │
      │ aggregation  │ 聚合到 indicator 维度              │
      │ post_agg     │ 聚合后调整                         │
      │ outcome      │ 最终结果生成                       │
      └──────────────┴──────────────────────────────────┘

5 种执行器:
  execFixed:        固定加分 (config.score)
  execPerUnit:      按单位加分 (score_per_unit × floor(totalUnits / divisor))
  execCap:          封顶 (config.max / config.min)
  execDedup:        去重 (config.strategy: take_highest)
  execCoefficient:  系数调整 (config.coefficient)

每步写入:
  calculation_rule_results: 规则执行结果（matched/executed/score_before/change/after）
  calculation_steps:        计算步骤（computation/output_value）
  manual_review_tasks:      人工审核任务（auto_level=manual_required 的规则）

完成:
  UPDATE calculation_tasks SET status='completed', total_score=?
  INSERT calculation_metric_results (per indicator: raw/adjusted/final score)
```

---

## 六、调用链总表

```
┌────────┬──────────────────────┬──────────┬─────────────┬─────────────────┬──────────────┐
│ 阶段   │ 前端入口              │ API 路由  │ Controller   │ Service          │ DB 写入      │
├────────┼──────────────────────┼──────────┼─────────────┼─────────────────┼──────────────┤
│ 上传   │ SmartFillRule.onFiles │ POST     │ ruleCtrl     │ —                │ rule_sources │
│        │                      │ /rules/   │ .uploadRule  │                  │              │
│        │                      │ upload    │ Files        │                  │              │
├────────┼──────────────────────┼──────────┼─────────────┼─────────────────┼──────────────┤
│ 解析   │ SmartFillRule        │ POST     │ ruleCtrl     │ parseRule        │ rule_sets,   │
│        │ .doParse             │ /rules/   │ .parseRule   │ SourceV2         │ doc_blocks,  │
│        │                      │ sources/  │ Source       │ (ruleParser.js)  │ indicator_   │
│        │                      │ :id/parse │ (异步)       │                  │ nodes,       │
│        │                      │           │              │                  │ rule_packages│
│        │                      │           │              │                  │ executable_  │
│        │                      │           │              │                  │ rules,       │
│        │                      │           │              │                  │ lookup_*     │
├────────┼──────────────────────┼──────────┼─────────────┼─────────────────┼──────────────┤
│ 发布   │ SmartFillRule        │ POST     │ ruleSetCtrl  │ —                │ rule_sets    │
│        │ .publishSet          │ /rule-   │ .publish     │                  │ (UPDATE)     │
│        │                      │ sets/    │ RuleSet      │                  │              │
│        │                      │ :id/     │              │                  │              │
│        │                      │ publish  │              │                  │              │
├────────┼──────────────────────┼──────────┼─────────────┼─────────────────┼──────────────┤
│ 材料   │ SmartFillMaterial    │ POST     │ materialCtrl │ —                │ materials    │
│ 创建   │ .emit('create')      │ /materials│ .create      │                  │              │
│        │                      │           │ Material     │                  │              │
├────────┼──────────────────────┼──────────┼─────────────┼─────────────────┼──────────────┤
│ 附件   │ SmartFillMaterial    │ POST     │ materialCtrl │ —                │ attachments  │
│ 上传   │ .onFiles             │ /materials│ .upload      │                  │              │
│        │                      │ /:id/     │ Attachments  │                  │              │
│        │                      │ upload    │              │                  │              │
├────────┼──────────────────────┼──────────┼─────────────┼─────────────────┼──────────────┤
│ 事实   │ SmartFillMaterial    │ POST     │ materialCtrl │ extract          │ material_    │
│ 提取   │ .doExtract           │ /materials│ .extract     │ StructuredFacts  │ recognitions │
│        │                      │ /:id/     │ Material     │ (factExtractor)  │ (raw_ai_     │
│        │                      │ extract   │              │                  │ response)    │
├────────┼──────────────────────┼──────────┼─────────────┼─────────────────┼──────────────┤
│ 匹配   │ SmartFillMaterial    │ POST     │ materialCtrl │ matchFact        │ — (只读)     │
│ +预览  │ .doPreview           │ /materials│ .preview     │ Pipeline         │              │
│        │ (@change 字段)       │ /:id/     │ Score        │ (ruleBlock       │              │
│        │                      │ preview   │              │ Matcher)         │              │
│        │                      │           │              │ + calculate      │              │
│        │                      │           │              │ ScorePreview     │              │
│        │                      │           │              │ (material        │              │
│        │                      │           │              │ Pipeline)        │              │
├────────┼──────────────────────┼──────────┼─────────────┼─────────────────┼──────────────┤
│ 入库   │ SmartFillMaterial    │ POST     │ materialCtrl │ —                │ material_    │
│        │ .doConfirm           │ /materials│ .match       │                  │ recognitions │
│        │                      │ /:id/match│ Material     │                  │ (UPDATE)     │
├────────┼──────────────────────┼──────────┼─────────────┼─────────────────┼──────────────┤
│ 评分   │ SmartFillScore       │ POST     │ evalCtrl     │ execute          │ ❌ 断链      │
│ 计算   │ .emit('calculate')   │ /eval/   │ .calculate   │ Calculation      │              │
│        │                      │ calculate │ Score        │ (scoringEngine)  │              │
└────────┴──────────────────────┴──────────┴─────────────┴─────────────────┴──────────────┘
```

---

## 七、数据断链全景图

```
┌─────────────────────────────────────────────────────────────┐
│                    当前数据流向                               │
│                                                             │
│  材料上传 ──→ material_recognitions.raw_ai_response (JSON)   │
│                   ✅ 有数据                                   │
│                                                             │
│  材料上传 ──→ material_analysis_runs                         │
│                   ❌ 空表，无代码写入                         │
│                                                             │
│  材料上传 ──→ extracted_facts                                │
│                   ❌ 空表，无代码写入                         │
│                                                             │
│  规则解析 ──→ rule_source_refs                               │
│                   ❌ 空表，无代码写入                         │
│                                                             │
│  评分引擎 ── 读 material_analysis_runs → 空 → 无法加载事实   │
│  评分引擎 ── 读 extracted_facts → 空 → 无法计算              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 需要修复的 3 处写入缺失

| 缺失写入 | 应在何处补充 | 写入内容 |
|---------|------------|---------|
| `material_analysis_runs` | `extractMaterial` 或 `matchMaterial` | model_name, prompt_version, input_hash, output_hash, status='completed' |
| `extracted_facts` | `extractMaterial` | fact_key, fact_type, fact_data(JSON), semantic_hash, confidence |
| `rule_source_refs` | `parseRuleSourceV2` 事务写入 | entity_type, entity_id, doc_block_id, relation_type |

### 需要修复的 2 处读取错误

| 错误 | 修复方案 |
|------|---------|
| 前端 `calculateScore()` 无 body | 改为传 `{ rule_set_id, material_ids }` 或调用 `calculateScoreV2` |
| `SmartFillScore` 需获取 `rule_set_id` | 当前 props 只有 `materials` 和 `evaluation`，需要增加 `ruleSetId` 或从 ruleSets 中取已发布的 |

---

## 八、数据库核心表关系

```
rule_sources ───────────┐
  (上传的DOCX文件)       │ rule_set_documents
                        ├──────────────────── rule_sets
doc_blocks ─────────────┘                       │ (发布后锁定)
  (文档块结构)                                   │
                        ┌────────────────────────┤
                        │                        │
                  indicator_nodes          lookup_tables
                   (指标树)                  (查分表)
                        │                        │
                  rule_packages             lookup_dimensions
                   (规则包)                  (维度定义)
                        │                        │
                  executable_rules          lookup_cells
                   (可执行规则)              (单元格+hash)

materials ───── attachments ───── material_recognitions
  (材料)       (证明文件)            (识别结果, 含 raw_ai_response)

calculation_tasks ──→ calculation_task_inputs ──→ (material_analysis_runs ❌)
     │                      │                          │
     │                calculation_rule_results    extracted_facts ❌
     │                calculation_steps
     │                calculation_metric_results
     │                manual_review_tasks
```

---

## 九、修复路线图

### 第一步：打通前端 → 后端参数

```
SmartFillScore.vue:
  - 增加 ruleSetId prop
  - emit('calculate') 时传 { rule_set_id, material_ids }

SmartFill.vue:
  - calculateScore() 调用 api.calculateScoreV2(ruleSetId, materialIds)
  - 或修改 api.calculateScore 接受参数
```

### 第二步：补充 material_analysis_runs + extracted_facts 写入

```
materialController.extractMaterial:
  在 extractStructuredFacts 成功后:
    1. INSERT material_analysis_runs
       (material_id, model_name, prompt_version, input_hash, status='completed')
    2. 对每条 fact: INSERT extracted_facts
       (analysis_run_id, fact_key, fact_type, fact_data, semantic_hash, confidence)
  
  保留 raw_ai_response 用于前端恢复（不冲突）
```

### 第三步：接通评分引擎

```
evaluationController.calculateScore:
  1. 前端传入 rule_set_id + material_ids ✓ (第一步修好)
  2. 查询 material_analysis_runs → 能查到 ✓ (第二步修好)
  3. executeCalculation(taskId) → 10 阶段跑通
  4. 返回 score → 前端展示
```

### 第四步（可选）：补充 rule_source_refs

```
parseRuleSourceV2 事务写入中:
  对每个 indicator/package/rule, 写入关联的 doc_block_id 到 rule_source_refs
```

---

## 十、关键文件索引

| 层 | 文件 | 核心职责 |
|----|------|---------|
| 前端 | [SmartFill.vue](client/src/views/zongce/SmartFill.vue) | 仪表盘：4 卡片状态机 + 数据刷新 |
| 前端 | [SmartFillScore.vue](client/src/views/zongce/SmartFillScore.vue) | 评分展示：计算按钮 + 五维分数 + 加分明细 |
| 前端 | [SmartFillMaterial.vue](client/src/views/zongce/SmartFillMaterial.vue) | 材料编辑：事实提取 → 字段编辑 → 匹配预览 → 确认入库 |
| 前端 | [SmartFillRule.vue](client/src/views/zongce/SmartFillRule.vue) | 规则管理：上传/解析/发布/删除 |
| API | [zongce.js](client/src/api/zongce.js) | 30 个导出函数，6 个 DEAD |
| 路由 | [zongce.js](server/src/routes/zongce.js) | 35 条路由注册 |
| 控制器 | [evaluationController.js](server/src/controllers/zongce/evaluationController.js) | calculateScore / getEvaluation / getCalculation / resumeCalculation |
| 控制器 | [materialController.js](server/src/controllers/zongce/materialController.js) | extractMaterial / previewScore / matchMaterial |
| 控制器 | [ruleController.js](server/src/controllers/zongce/ruleController.js) | uploadRuleFiles / parseRuleSource（异步） |
| 引擎 | [scoringEngine.js](server/src/services/zongce/engine/scoringEngine.js) | executeCalculation: 10 阶段 5 执行器 |
| 服务 | [ruleParser.js](server/src/services/zongce/ai/parsing/ruleParser.js) | parseRuleSourceV2: 全流程编排 |
| 服务 | [docStructure.js](server/src/services/zongce/ai/parsing/docStructure.js) | DOCX 结构提取 + 章节识别 |
| 服务 | [factExtractor.js](server/src/services/zongce/ai/factExtractor.js) | extractStructuredFacts: OCR + 结构化提取 |
| 服务 | [ruleBlockMatcher.js](server/src/services/zongce/ai/ruleBlockMatcher.js) | matchFactPipeline: 两阶段匹配管线 |
| 服务 | [materialPipeline.js](server/src/services/zongce/ai/materialPipeline.js) | calculateScorePreview: 查表算分 |
| 服务 | [deepseek.js](server/src/services/zongce/ai/deepseek.js) | chatStream / chatStreamJson / ocrWithKimi |
| 服务 | [prompts.js](server/src/services/zongce/ai/prompts.js) | Prompt 模板：规则解析 / 事实提取 / 规则匹配 |
| 服务 | [schemas.js](server/src/services/zongce/ai/schemas.js) | AI 输出校验 |
| 数据库 | [init.sql](server/src/services/zongce/db/init.sql) | 38 张表定义 |
