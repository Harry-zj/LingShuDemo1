# 智能填表 · 规则解析 — 数据流动与数据库表说明

---

## 一、总览

规则解析是将用户上传的 **DOCX 综测规则文件**（如《湖南师范大学学生综合素质测评办法》）自动拆解为结构化计分规则的过程。

**一句话概括**：DOCX → 文档结构提取 → 章节拆分 → AI 并行解析 → 合并去重校验 → 写入数据库。

```
前端 SmartFillRule.vue
  → [API] POST /api/zongce/rules/sources/:id/parse
    → ruleController.parseRuleSource          ← 创建 ai_tasks 追踪记录，启动后台任务
      → runParseV2InBackground(taskId, sourceId, userId)
        → ruleParser.parseRuleSourceV2(sourceId, userId, onProgress)   ← 核心引擎
```

---

## 二、涉及的数据表（按写入顺序）

| 阶段 | 表名 | 操作 | 写入内容 |
|------|------|------|----------|
| 用户上传文件 | `rule_sources` | INSERT | 文件路径、状态 `pending` |
| 创建任务追踪 | `ai_tasks` | INSERT | 任务类型 `rule_parse`，状态 `processing` |
| Step 2 建规则集 | `rule_sets` | INSERT | 规则集版本，状态 `draft` |
| Step 2 关联文档 | `rule_set_documents` | INSERT | 规则集 ↔ 规则来源的关联 |
| Step 2 解析运行 | `document_parse_runs` | INSERT | 解析器版本、模型名、状态 `running` |
| Step 2 文档块 | `doc_blocks` | INSERT | 每个段落/标题/表格的结构化信息 |
| Step 5 计分规则 | `scoring_rules` | INSERT | AI 解析出的 F3 计分规则（每条一分） |
| 完成 | `rule_sources` | UPDATE | `status` → `parsed` |
| 完成 | `document_parse_runs` | UPDATE | `status` → `completed` / `failed` |
| 完成 | `ai_tasks` | UPDATE | `status` → `completed` / `failed` |

---

## 三、分步详解

### Step 1：文档结构提取（不涉及 AI）

**代码**：[docStructure.js](../ai/parsing/docStructure.js)

```
DOCX 文件
  ├─ [1] 内建 ZIP 读取器从 word/styles.xml 发现标题样式
  │       └→ discoverHeadingStyles() 识别 w:outlineLvl + 样式名匹配
  │
  ├─ [2] mammoth.convertToHtml() 将 DOCX 转为 HTML
  │       使用动态 styleMap（discovered + static 合并）
  │
  ├─ [3] parseHtml() 解析 HTML → doc_blocks[]
  │       ├─ heading  (h1-h6)          → confidence 0.95
  │       ├─ paragraph (粗体<60字)     → confidence 0.45（候选标题）
  │       ├─ paragraph (普通)          → confidence 0.9
  │       └─ table                     → confidence 0.95，含行列结构
  │
  └→ 输出: blocks[] (约 100-200 个 block)，存入 doc_blocks 表
```

**关键数据结构** — 每个 block：
```js
{
  block_type: "heading" | "paragraph" | "table",
  title: "第一章  总则",
  content: "第一章  总则",           // heading 时 title == content
  structured_content: { level: 3 },  // 标题层级（1-6），paragraph 为 null
  source_location: "",
  order_index: 0,                    // 原始文档顺序
  style_info: { heading_level, style_id, style_name },
  numbering_info: "第一章",          // 自动识别的编号信息
  structure_confidence: 0.95         // 结构置信度
}
```

---

### Step 2：章节识别 + 解析任务拆分

**代码**：[ruleParser.js](../ai/parsing/ruleParser.js) `buildChapterTree()` + `buildParseTasks()` + `splitLargeTasks()`

#### 2.1 章节识别

```
doc_blocks[] → buildChapterTree(blocks)
  ├─ 遍历每个 block
  ├─ isTopChapter(block) 判断是否为顶层章节：
  │   ├─ 文本匹配: /^第[一二三四五六七八九十\d]+章/ → chapter（最高优先级）
  │   │   排除：第X条、注：、说明：、(一)(二)、B1-B8、表N
  │   ├─ Heading 1 → chapter
  │   └─ 甚至 paragraph 也能提升为 chapter（只要文本匹配"第X章"）
  │
  └→ chapters[] 数组，每个 chapter 包含：
      ├─ id, title, block_start, block_end
      └─ sections[] (可选，按 heading 2-6 / 编号子标题切分)
```

**示例输出**：
```
7 个 chapter：
  ch1: 第一章  总则           (blocks 0-7)
  ch2: 第二章  基本素质测评    (blocks 8-55)
  ch3: 第三章  课程学习成绩测评 (blocks 56-65)
  ch4: 第四章  创新素质测评    (blocks 66-165)  ← 最大，需拆分
  ch5: 第五章  测评结果及应用  (blocks 166-168)
  ch6: 第六章  组织与实施      (blocks 169-170)
  ch7: 第七章  附则            (block 171)
```

#### 2.2 初始任务拆分

```
chapters → buildParseTasks(blocks, chapters)
  ├─ chapter 有 sections → 每个 section 一个任务
  └─ chapter 无 sections → 整个 chapter 一个任务
```

#### 2.3 大任务智能再拆分

```
splitLargeTasks(blocks, parseTasks)
  ├─ 阈值: 超过 4000 字符 或 表格数 > 2 → 必须拆分
  ├─ 策略1: 按业务块边界 (B1-B8) 拆分
  └─ 策略2: 按"表格标题 + 表格 + 注/说明"语义单元拆分
      ↓
  例: ch4 (第四章, ~8000字) → B1~B8 共 8 个子任务
```

**最终任务结构**：
```js
{
  chapter_id: "ch4",
  chapter_title: "第四章  创新素质与实践能力测评",
  section_id: null,
  section_title: null,
  block_start: 88, block_end: 101,
  is_sub_task: true,
  business_block_title: "（一）职业技能类（B1）",
  char_count: 769
}
```

---

### Step 3：AI 并行解析（DeepSeek API）

**代码**：[deepseek.js](../ai/deepseek.js) `chatStreamJson()` + [prompts.js](../ai/prompts.js) `V3_RULE_PARSE_SYSTEM`

```
13 个任务，每批 6 个并行 → DeepSeek API
  每个任务的请求体:
    System: V3_RULE_PARSE_SYSTEM
      "只提取 F3（创新实践）计分规则。
       字段: item_key(B1~B8), score_level(national/provincial/school/college),
             score_rank, score(整数), keywords, description
       只提取明确有分数的规则。表格按单元格拆分。"
    User: "=== 第四章 > （一）职业技能类（B1）===\n[该章节 DOCX 文本]"
      
  单个任务重试策略（最多 3 次）:
    重试条件: terminated / ETIMEDOUT / ECONNRESET / 格式异常
    不重试:   API 401/403 等认证错误

  AI 返回 → chatStreamJson 处理:
    ├─ 流式接收 DeepSeek SSE → 累积完整文本
    ├─ extractAndCleanJson(): 去掉 code block、找 JSON 边界、修复尾逗号
    ├─ repairTruncatedJson(): 补全未闭合括号/字符串
    ├─ 5 种清洗策略依次尝试 → JSON.parse()
    └→ 返回 { f3_rules: [...] }
```

**每个任务返回格式**：
```json
{
  "f3_rules": [
    {
      "item_key": "B2",
      "item_name": "学科竞赛",
      "score_level": "national",
      "score_rank": "一等奖",
      "score": 10,
      "keywords": "数学建模 挑战杯 程序设计",
      "description": "国家级学科竞赛一等奖加10分"
    }
  ]
}
```

---

### Step 4：单任务去重 + 跨任务合并

**代码**：[ruleParser.js](../ai/parsing/ruleParser.js) `dedupPerTask()` + `mergeAndDedupResults()`

```
每个任务的 AI 结果
  └→ dedupPerTask(result)
      单任务内去重: 按 canonical_key 去重

所有任务结果
  └→ mergeAndDedupResults(allResults, allTasks)
      ├─ indicators: 递归树合并
      ├─ packages: 按 canonical_key 合并 rules
      ├─ lookup_tables + uncertainties: 按 key 合并
      └→ 输出: { merged, sourceRefs, duplicates }
```

---

### Step 5：写入数据库

**代码**：[ruleParser.js](../ai/parsing/ruleParser.js) 第 597-627 行

```sql
-- 每条 F3 规则写入 scoring_rules 表
INSERT INTO scoring_rules
  (rule_set_id, user_id, section, item_key, item_name,
   score_level, score_rank, score, keywords, description,
   max_score, dedup_group, status)
VALUES (?, ?, 'F3', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
```

**字段映射**：
| AI 字段 | DB 列 | 类型 | 说明 |
|---------|-------|------|------|
| `item_key` | `item_key` | VARCHAR(10) | B1-B8 |
| `item_name \|\| description` | `item_name` | VARCHAR(200) | 规则名称 |
| `score_level` | `score_level` | VARCHAR(20) | national/provincial/school/college |
| `score_rank` | `score_rank` | VARCHAR(50) | 原始排名文本 |
| `score` | `score` | INT | 分数 |
| `keywords` | `keywords` | TEXT | 空格分隔的关键词 |
| `description` | `description` | TEXT | 完整描述 |
| `max_score` | `max_score` | INT | 上限分 |
| `dedup_group` | `dedup_group` | VARCHAR(50) | 去重组标记 |

---

## 四、完整数据流图

```
                              ┌─────────────┐
                              │  用户上传    │
                              │  DOCX 文件   │
                              └──────┬──────┘
                                     │
                                     ▼
                        ┌──────────────────────┐
                        │  rule_sources        │  INSERT (source_type='file', status='pending')
                        │  ai_tasks            │  INSERT (status='processing')
                        └──────────┬───────────┘
                                   │
                                   ▼
                        ┌──────────────────────┐
                        │  docStructure.js     │  确定性解析（不用 AI）
                        │  mammoth HTML 转换    │
                        │  + 章节识别           │
                        └──────────┬───────────┘
                                   │
                    ┌──────────────┼──────────────┐
                    │              │              │
                    ▼              ▼              ▼
           ┌──────────────┐ ┌───────────┐ ┌────────────────┐
           │ rule_sets    │ │ doc_blocks│ │ doc_parse_runs │
           │ (INSERT)     │ │ (INSERT)  │ │ (INSERT)       │
           └──────────────┘ └───────────┘ └────────────────┘
           │ rule_set_     │
           │ documents     │
           │ (INSERT)      │
           └──────────────┘
                    │
                    ▼
           ┌───────────────────┐
           │  13 个解析任务     │  每批 6 个并行
           │  每任务 1 次 AI 调用│  DeepSeek v4-flash
           └────────┬──────────┘
                    │
                    ▼
           ┌───────────────────┐
           │  AI 返回 f3_rules │  5 种 JSON 清洗策略
           │  单任务去重        │
           │  跨任务合并        │
           └────────┬──────────┘
                    │
                    ▼
           ┌───────────────────┐
           │  scoring_rules    │  INSERT（每条规则一行）
           │  (INSERT)         │
           └────────┬──────────┘
                    │
          ┌─────────┴─────────┐
          │                   │
          ▼                   ▼
    ┌───────────┐      ┌───────────────┐
    │rule_sources│      │doc_parse_runs │
    │UPDATE      │      │UPDATE         │
    │parsed      │      │completed/fail │
    └───────────┘      └───────────────┘
          │
          ▼
    ┌───────────┐
    │ ai_tasks  │
    │ UPDATE    │
    │ completed │
    └───────────┘
```

---

## 五、各表详细结构

### `rule_sources` — 规则来源
| 列 | 类型 | 说明 |
|----|------|------|
| id | INT PK | |
| user_id | INT | 上传者 |
| source_type | ENUM('file','text') | 文件或纯文本 |
| file_name | VARCHAR(255) | 原始文件名 |
| file_path | VARCHAR(500) | 服务器路径 |
| original_text | LONGTEXT | 文本内容 |
| status | ENUM('pending','parsed') | pending→parsed |
| file_hash | CHAR(64) | 文件 SHA256 |
| is_frozen | TINYINT(1) | 是否冻结 |

### `ai_tasks` — AI 任务追踪
| 列 | 类型 | 说明 |
|----|------|------|
| id | INT PK | |
| target_type | VARCHAR(50) | 'rule_parse' |
| target_id | INT | rule_sources.id |
| status | ENUM('pending','processing','completed','failed') | |
| result | JSON | 进度数据（SSE 轮询用） |
| error_msg | TEXT | 失败原因 |

### `doc_blocks` — 文档结构块
| 列 | 类型 | 说明 |
|----|------|------|
| id | INT PK | |
| rule_source_id | INT | → rule_sources.id |
| parse_run_id | INT | → document_parse_runs.id |
| block_type | ENUM('heading','paragraph','table','list','note','formula','image') | |
| title | VARCHAR(500) | 标题文本 |
| content | LONGTEXT | 完整文本 |
| structured_content | JSON | `{ level, rows, header_rows, ... }` |
| source_location | VARCHAR(200) | 原始位置 |
| order_index | INT | 文档顺序 |
| is_frozen | TINYINT(1) | 是否冻结 |

### `document_parse_runs` — 文档解析运行记录
| 列 | 类型 | 说明 |
|----|------|------|
| id | INT PK | |
| rule_source_id | INT | → rule_sources.id |
| parser_version | VARCHAR(20) | 'v2' |
| model_name | VARCHAR(50) | 'mammoth' |
| prompt_version | VARCHAR(20) | 'v1' |
| input_hash | CHAR(64) | 输入文档 hash |
| raw_ai_response | LONGTEXT | AI 原始返回 |
| status | ENUM('running','completed','failed','parse_structure_failed') | |

### `rule_sets` — 规则集
| 列 | 类型 | 说明 |
|----|------|------|
| id | INT PK | |
| user_id | INT | 创建者 |
| version_label | VARCHAR(100) | 版本标签（默认用文件名） |
| cloned_from_id | INT | 克隆来源 |
| status | ENUM('draft','published','archived','parse_structure_failed') | |

### `rule_set_documents` — 规则集-文档关联
| 列 | 类型 | 说明 |
|----|------|------|
| id | INT PK | |
| rule_set_id | INT | → rule_sets.id |
| rule_source_id | INT | → rule_sources.id |
| document_role | ENUM('primary','supplement','amendment','appendix','interpretation') | 默认 'primary' |

### `scoring_rules` — 计分规则（最终产物）
| 列 | 类型 | 说明 |
|----|------|------|
| id | INT PK | |
| rule_set_id | INT | → rule_sets.id |
| user_id | INT | 所属用户 |
| section | VARCHAR(10) | 固定 'F3' |
| item_key | VARCHAR(10) | B1-B8 |
| item_name | VARCHAR(200) | 规则名称 |
| score_level | VARCHAR(20) | 级别 |
| score_rank | VARCHAR(50) | 排名 |
| score | INT | 分值 |
| keywords | TEXT | 关键词 |
| description | TEXT | 描述 |
| max_score | INT | 上限分 |
| dedup_group | VARCHAR(50) | 去重组 |
| status | ENUM('active','inactive') | 默认 'active' |

---

## 六、关键设计决策

1. **文档结构确定性解析**：Chapter 识别不依赖 AI，用正则和样式信息，100% 可重现
2. **大任务智能拆分**：4000 字阈值，按业务块（B1-B8）或表格语义单元切分，避免 AI 上下文窗口溢出
3. **每任务独立 AI 调用 + 跨任务合并**：并行 6 路提升速度，事后按 canonical_key 去重合并
4. **JSON 多策略清洗**：AI 返回格式不可控，5 层降级策略保证鲁棒性
5. **V3 简化**：AI 只做"文字理解"输出 `f3_rules[]`，不做规则匹配（匹配交给后续的匹配管线）
6. **SSE 进度推送**：前端通过 `/stream` 端点实时获取解析进度
