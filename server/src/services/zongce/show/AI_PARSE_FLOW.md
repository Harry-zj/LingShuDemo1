# V2 规则解析完整流程

## 触发

用户上传 DOCX 文件 → 点"🔍 解析"按钮

## 全链路

```
前端 SmartFillRule.vue
  → doParse(sourceId)
    → POST /api/zongce/rules/sources/:id/parse
      → ruleController.parseRuleSource
        → 后台: runParseV2InBackground
          → ruleParser.parseRuleSourceV2(sourceId, userId)
```

## 详细步骤

### Step 1: 提取 DOCX 结构 (docStructure.js)

```
DOCX 文件 → mammoth.convertToHtml（保留样式映射）
  → 解析 HTML → doc_blocks[]
    - Heading 1-6（Word 标题样式）→ confidence 0.95
    - 粗体短段落（<60字）→ confidence 0.45（候选标题）
    - 表格 → 含行/列/表头
    - 普通段落
    - 编号信息、原始顺序
```

### Step 2: 章节识别 (docStructure.js → buildChapterTree)

```
遍历所有 heading blocks，判断每个是：

顶层章 (chapter)：
  - Word Heading 1 样式（level === 1）
  - 或严格匹配 "第X章" 文本模式
  - 排除："第XX条"、"表1"、"注："、"说明："

章内节 (section)：
  - Heading 2-6
  - 编号子标题：(一)、1.、B1-B8 等
  - 高置信度短标题

普通候选标题 → 不作为章节边界
```

### Step 3: 拆分解析任务 (docStructure.js → buildParseTasks)

```
每个 section → 一个解析任务
无 section 的 chapter → 整章一个任务

每个任务记录：
  - 所属 chapter_id / chapter_title
  - section_id / section_title
  - block 范围 [start, end]
```

### Step 4: 并行 AI 解析 (ruleParser.js)

```
所有 parse tasks → 每批 6 个并行
  → 每个 task 调 DeepSeek
    - System Prompt: V2_RULE_PARSE_SYSTEM
      要求输出：indicators（指标子树）、packages（规则包）、
                rules（可执行规则）、lookup_tables（查分表）
    - User Prompt: 该任务范围内的 blocks 文本
    - maxTokens: 8192

  → 返回 JSON → 校验 validateV2RuleParse
  → JSON 截断则此 task 失败（不阻塞其他 task）
```

### Step 5: 合并去重

```
所有 task 结果 → 按 canonical_key 去重
  - indicators: canonical_key 相同 → 只保留一个
  - packages: canonical_key 相同 → 只保留一个
  - lookup_tables: 追加
  - uncertainties: 追加
```

### Step 6: 清洗 + 校验

```
清洗 AI 输出常见问题：
  - auto_level: "auto"/"automatic" → "automatic"
  - scope: 非法值 → "per_fact"
  - rule_type: "reference" → "lookup", "sum" → "fixed"

validateV2RuleParse：
  - indicator 必须有 code / name / canonical_key
  - canonical_key 不重复
  - rule_type 在允许列表中
  - execution_stage 在允许列表中
```

### Step 7: 事务写入

```
BEGIN TRANSACTION
  DELETE 旧 indicator_nodes（同 rule_set）
  INSERT indicator_nodes（递归写父子关系）
  INSERT rule_packages
  INSERT executable_rules（含 config/input_selector/condition/scope）
  INSERT lookup_tables / lookup_dimensions / lookup_cells
  UPDATE rule_sources.status = 'parsed'
COMMIT / ROLLBACK
```

## 关键文件

| 文件 | 职责 |
|------|------|
| `ai/parsing/docStructure.js` | mammoth HTML → doc_blocks + 章节识别 + 任务拆分 |
| `ai/parsing/ruleParser.js` | parseRuleSourceV2: 编排整个流程 |
| `ai/prompts.js` | V2_RULE_PARSE_SYSTEM: AI 输出格式定义 |
| `ai/schemas.js` | validateV2RuleParse: 校验合并后的 AI 输出 |
| `controllers/zongce/ruleController.js` | 异步启动解析，SSE 通知完成 |
| `routes/zongce.js` | POST /api/zongce/rules/sources/:id/parse |

## 当前已知问题

章节识别：buildChapterTree 仅支持 Word Heading 1 或 "第X章" 格式。
如果文档用其他编号体系（如 F1/F2/F3），需要扩展识别规则。
