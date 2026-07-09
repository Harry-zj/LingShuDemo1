# 灵枢 - 核心引擎设计文档

> 模块一（智能评分）+ 模块二（自动填表）的完整设计方案

---

## 一、功能概述

### 功能 1：自动计算综测

```
上传综测规则 → AI 解析规则 → 上传证明材料 → AI 分析材料 → 自动归类加分 → 输出置信度 + 说明文本
```

### 功能 2：自动填表

```
评分结果 + Word 模板 → 自动填充 → 下载 .docx 文件
```

---

## 二、数据库设计

### 整体 ER 关系

```
batch（综测批次，如"2025春综测"）
  │
  ├── 1:N ── rules（评分规则）────────── NEW!
  │           一个批次可以有多个规则来源
  │           （Word 文档 + Excel 表格 + 手动输入文字补充）
  │
  ├── 1:N ── materials（学生提交的材料）── 已有
  │            │
  │            └── 1:N ── attachments（证明文件：图片/PDF/Word）── 已有
  │
  ├── 1:N ── evaluation_results（评定结果）── 已有
  │
  └── 1:N ── fill_templates（填表模板）──── NEW!
```

---

### 新表一：rules（评分规则）

```sql
CREATE TABLE rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL,              -- 属于哪个批次
  name VARCHAR(200),                  -- 如"2025综测办法.docx"
  source_type VARCHAR(20),            -- 'file' | 'text'（文件上传还是手动输入）
  original_text TEXT,                 -- 从文件提取的原始文本
  structured_rules JSON,              -- AI 解析后的结构化规则 ★核心字段★
  status ENUM('pending','parsed','published') DEFAULT 'pending',
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**设计说明**：一个批次可以有多条规则记录（比如同时上传了 Word 规则文档 + Excel 加分表 + 手动写的补充说明），评分计算时合并该批次所有规则。

#### structured_rules JSON 结构（核心）

```json
{
  "version": 1,
  "dimensions": {
    "moral": {
      "name": "德育",
      "max_score": 20,
      "items": [
        {
          "id": "moral_001",
          "description": "国家级荣誉称号（如全国优秀共青团员、全国三好学生等）",
          "level": "national",
          "score": 5.0,
          "type": "add",
          "proof_required": ["证书扫描件", "表彰文件"],
          "max_times": 1,
          "conflict_group": "honor_title"
        },
        {
          "id": "moral_002",
          "description": "省级荣誉称号",
          "level": "provincial",
          "score": 3.0,
          "type": "add",
          "proof_required": ["证书扫描件"],
          "max_times": 1,
          "conflict_group": "honor_title"
        }
      ]
    },
    "intellectual": { "name": "智育", "max_score": 30, "items": [] },
    "physical":     { "name": "体育", "max_score": 10, "items": [] },
    "aesthetic":    { "name": "美育", "max_score": 10, "items": [] },
    "labor":        { "name": "劳育", "max_score": 10, "items": [] }
  },
  "conflict_rules": {
    "same_group_take_highest": true,
    "description": "同一 conflict_group 内的项目只取最高分，不重复计算"
  }
}
```

**字段含义**：

| 字段 | 含义 |
|------|------|
| `id` | 规则唯一标识，如 `moral_001`，材料匹配时引用 |
| `conflict_group` | 互斥组。同一组内只取最高分（如国家级和省级荣誉称号互斥，只加最高的） |
| `max_times` | 该规则最多使用次数 |
| `level` | 级别 `national/provincial/school`，辅助AI判断 |
| `proof_required` | 需要的证明材料类型 |
| `type` | `add`（加分）或 `subtract`（扣分） |

---

### 新表二：fill_templates（填表模板）

```sql
CREATE TABLE fill_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT,
  name VARCHAR(200),                  -- 模板名称
  file_path VARCHAR(500),             -- .docx 文件存储路径
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

#### 模板制作规范（固定占位符）

制作 Word 模板时，在需要填数据的地方使用以下占位符：

| 占位符 | 含义 | 示例值 |
|--------|------|--------|
| `{real_name}` | 学生姓名 | 陈灵湘 |
| `{student_id}` | 学号 | 2024001 |
| `{class_name}` | 班级 | 计算机2401 |
| `{total_score}` | 总分 | 60.0 |
| `{moral_score}` | 德育得分 | 15.0 |
| `{moral_max}` | 德育满分 | 20.0 |
| `{moral_detail}` | 德育加分明细 | "国家级荣誉称号+5, 志愿服务+10" |
| `{intellectual_score}` | 智育得分 | 22.0 |
| `{intellectual_max}` | 智育满分 | 30.0 |
| `{intellectual_detail}` | 智育加分明细 | |
| `{physical_score}` | 体育得分 | 8.0 |
| `{physical_max}` | 体育满分 | 10.0 |
| `{physical_detail}` | 体育加分明细 | |
| `{aesthetic_score}` | 美育得分 | 5.0 |
| `{aesthetic_max}` | 美育满分 | 10.0 |
| `{aesthetic_detail}` | 美育加分明细 | |
| `{labor_score}` | 劳育得分 | 10.0 |
| `{labor_max}` | 劳育满分 | 10.0 |
| `{labor_detail}` | 劳育加分明细 | |

> 这样设计的优势：用户只需按清单制作模板，系统自动填充，不需要额外的"映射配置"步骤。

---

### 新表三：ai_tasks（异步任务追踪）

```sql
CREATE TABLE ai_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  target_type VARCHAR(50),            -- 'rule_parse' | 'material_analyze'
  target_id INT,                      -- 对应 rules.id 或 attachments.id
  status ENUM('pending','processing','completed','failed') DEFAULT 'pending',
  result JSON,                        -- AI 返回的原始结果
  error_msg TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL
);
```

**用途**：AI 调用可能耗时 5-30 秒，前端提交任务后轮询此表查询处理进度。

---

### 利用现有表（不需要改结构）

以下表和字段已经存在，直接往里面写数据即可：

| 表 | 字段 | 写入内容 |
|----|------|----------|
| `materials` | `rule_match` (JSON) | AI 匹配结果（匹配到哪些规则） |
| `materials` | `ai_confidence` (DECIMAL) | 综合置信度 |
| `materials` | `category` (VARCHAR) | 归类：moral/intellectual/physical/aesthetic/labor |
| `evaluation_results` | `dimension_scores` (JSON) | 五维得分明细 |
| `evaluation_results` | `total_score` (DECIMAL) | 总分 |
| `evaluation_results` | `advice` (JSON) | AI 生成的评价建议 |
| `attachments` | `ai_label` (VARCHAR) | AI 分类标签，如"荣誉证书/国家级" |

#### materials.rule_match JSON 结构

```json
{
  "category": "moral",
  "matches": [
    {
      "rule_id": "moral_001",
      "rule_desc": "国家级荣誉称号",
      "suggested_score": 5.0,
      "confidence": 0.92,
      "explanation": "该证书为共青团中央颁发的'全国优秀共青团员'，属于国家级荣誉称号，符合德育第1条加分规则"
    }
  ],
  "analyzed_at": "2025-01-15T10:30:00Z"
}
```

#### evaluation_results.dimension_scores JSON 结构

```json
{
  "moral": {
    "score": 15.0,
    "max": 20.0,
    "items": [
      { "rule_id": "moral_001", "desc": "国家级荣誉称号", "score": 5.0, "material_id": 10 },
      { "rule_id": "moral_005", "desc": "志愿服务满40小时", "score": 10.0, "material_id": 12 }
    ]
  },
  "intellectual": { "score": 22.0, "max": 30.0, "items": [] },
  "physical":     { "score": 8.0,  "max": 10.0, "items": [] },
  "aesthetic":    { "score": 5.0,  "max": 10.0, "items": [] },
  "labor":        { "score": 10.0, "max": 10.0, "items": [] }
}
```

---

## 三、数据流动全链路

```
[Step 1] 老师上传规则文件（Word/Excel）
         → mammoth/xlsx 提取文本
         → DeepSeek AI 解析为 structured_rules JSON
         → 存入 rules 表（一个批次可以有多条规则）

[Step 2] 学生创建材料 + 上传证明文件（图片/PDF/Word）
         → 图片：直接发给 DeepSeek Vision 分析
         → 文档：提取文本后发给 DeepSeek 分析
         → Prompt："根据以下规则，判断这个材料属于哪个维度、匹配哪条规则..."
         → AI 返回 { category, matches: [{rule_id, confidence, explanation}] }
         → 写入 materials.rule_match + materials.ai_confidence
         → 写入 attachments.ai_label

[Step 3] 触发评分计算（纯 JS 逻辑，不调 AI）
         → 读取 rules.structured_rules（该批次所有规则合并）
         → 读取 materials（该学生所有已分析的材料）
         → 遍历材料 × 规则，处理冲突：
            · 同一 conflict_group 内只取最高分
            · max_times 限制检查
            · 各维度 max_score 上限
         → 写入 evaluation_results

[Step 4] 自动填表
         → 读取 evaluation_results + users
         → 构建数据对象 { real_name, total_score, moral_score, ... }
         → docxtemplater 填充 Word 模板
         → 生成 .docx 文件 → 返回下载链接
```

---

## 四、后端架构

```
server/src/
├── config/
│   ├── database.js          ← 数据库连接 + 建表（添加3张新表）
│   └── index.js             ← 全局配置（添加 DeepSeek 配置）
├── services/                ← 业务逻辑层（新建目录）
│   ├── aiService.js         ← 统一封装 DeepSeek API 调用
│   ├── ruleService.js       ← 规则解析引擎
│   ├── materialService.js   ← 材料 AI 分析
│   ├── scoringService.js    ← 自动评分引擎（纯手写 JS）
│   └── fillService.js       ← Word 模板填充
├── controllers/
│   ├── module1Controller.js ← 扩展，添加规则/模板/填表接口
│   └── module2Controller.js ← 扩展，添加评分计算接口
├── routes/
│   ├── module1.js           ← 扩展路由
│   └── module2.js           ← 扩展路由
├── middleware/
│   ├── auth.js              ← JWT 认证（已有）
│   └── upload.js            ← 文件上传（已有）
└── app.js                   ← Express 入口（已有）
```

---

## 五、API 接口设计

### 规则管理（module1 扩展）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/module1/rules/upload` | 上传规则文件（.docx/.xlsx），触发 AI 解析 |
| GET | `/api/module1/rules/:batchId` | 获取某批次的所有规则列表 |
| GET | `/api/module1/rules/:id/structured` | 获取某条规则的解析结果（structured_rules） |
| PUT | `/api/module1/rules/:id` | 手动编辑/修正结构化规则 |

### 材料分析（module1 扩展）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/module1/materials/:id/analyze` | 触发 AI 分析某材料的所有附件 |
| GET | `/api/module1/materials/:id/analysis` | 查看材料的 AI 分析结果 |

### 评分计算（module2 扩展）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/module2/calculate/:batchId/:studentId` | 为某个学生计算总分 |
| POST | `/api/module2/calculate/:batchId` | 为整个批次所有学生批量计算 |
| GET | `/api/module2/result/:batchId/:studentId` | 查看评分结果详情 |

### 模板与填表（module1 扩展）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/module1/templates/upload` | 上传 Word 填表模板 |
| GET | `/api/module1/templates` | 模板列表 |
| POST | `/api/module1/fill/:studentId` | 为某学生生成填好的表 |
| GET | `/api/module1/fill/:id/download` | 下载填好的 .docx 文件 |

---

## 六、AI 服务层设计

### DeepSeek API

DeepSeek API 兼容 OpenAI 的 `/v1/chat/completions` 格式，直接用原生 `fetch` 调用即可，无需额外 SDK。

```
POST https://api.deepseek.com/v1/chat/completions
Header: Authorization: Bearer {DEEPSEEK_API_KEY}
Body: {
  model: "deepseek-chat",
  messages: [
    { role: "system", content: "你是综测规则解析助手..." },
    { role: "user", content: "请解析以下规则文档..." }
  ],
  temperature: 0.3,
  response_format: { type: "json_object" }  // 约束输出 JSON
}
```

### aiService.js 提供三个方法

```js
// 1. 通用对话
chat(messages, options) → AI 文本响应

// 2. 图片分析（DeepSeek 支持图片 base64 输入）
analyzeImage(base64Image, prompt) → AI 图片分析结果

// 3. 结构化提取（从文本提取为指定 JSON Schema）
extractStructuredData(text, schema) → 结构化 JSON
```

### Prompt 设计原则

- **规则解析**：把 System Prompt 写成"你是综测办法解析器"，给定输出格式模板，让 AI 按固定 JSON Schema 输出
- **材料分析**：把规则 JSON 嵌入 Prompt，让 AI 对照规则判断材料匹配哪条、置信度多少
- **始终要求 AI 输出 JSON**，利用 `response_format: { type: "json_object" }` 约束

---

## 七、评分引擎核心算法

这部分**尽量手写，不用 AI 生成**，是锻炼编程能力的关键。

```js
function calculateScore(rules, materials) {
  const dimensions = ['moral', 'intellectual', 'physical', 'aesthetic', 'labor'];
  const result = {};

  for (const dim of dimensions) {
    const dimRules = rules.dimensions[dim];
    result[dim] = { score: 0, max: dimRules.max_score, items: [] };

    for (const rule of dimRules.items) {
      // 1. 找出匹配该规则的材料
      const matched = materials.filter(m => {
        const ruleMatch = m.rule_match;
        return ruleMatch && ruleMatch.matches?.some(
          match => match.rule_id === rule.id
        );
      });

      if (matched.length === 0) continue;

      // 2. 同一 conflict_group 只取最高分
      let selected = matched;
      if (rule.conflict_group) {
        selected = [matched.reduce((best, cur) => {
          const curScore = cur.rule_match.matches.find(m => m.rule_id === rule.id).suggested_score;
          const bestScore = best.rule_match.matches.find(m => m.rule_id === rule.id).suggested_score;
          return curScore > bestScore ? cur : best;
        })];
      }

      // 3. max_times 限制
      selected = selected.slice(0, rule.max_times || Infinity);

      // 4. 累加分数
      for (const mat of selected) {
        const matchInfo = mat.rule_match.matches.find(m => m.rule_id === rule.id);
        result[dim].score += matchInfo.suggested_score;
        result[dim].items.push({
          rule_id: rule.id,
          desc: rule.description,
          score: matchInfo.suggested_score,
          material_id: mat.id
        });
      }
    }

    // 5. 不超过维度上限
    result[dim].score = Math.min(result[dim].score, dimRules.max_score);
  }

  result.total = Object.values(result).reduce((sum, d) => sum + d.score, 0);
  return result;
}
```

### 需要处理的评分规则类型

| 规则 | 说明 | 实现方式 |
|------|------|----------|
| 同类取最高 | 同一 conflict_group 内只取最高分 | 按组分组 → 取 max |
| 次数上限 | 同一规则最多使用 N 次 | `slice(0, max_times)` |
| 维度上限 | 某维度总分不超过 max_score | `Math.min(score, max_score)` |
| 加分/扣分 | type 为 add 或 subtract | 根据 type 决定加还是减 |

---

## 八、前端页面规划

### 需要新建的页面

1. **RuleUpload.vue** — 规则上传与解析
   - 上传区（支持 .docx / .xlsx / .pdf / 手动输入文字）
   - 解析进度（pending → processing → completed）
   - 解析结果展示（可折叠的五维规则列表）
   - 支持手动编辑/微调规则

2. **AutoFill.vue** — 自动填表
   - 上传 Word 模板（附占位符清单说明）
   - 选择学生 → 一键生成
   - 下载填好的文件

### 需要重构的现有页面

3. **SmartFill.vue** — 材料上传与分析（重构）
   - 材料上传区（多文件、拖拽）
   - 材料卡片（显示 AI 分析结果标签：归类 + 匹配规则 + 置信度）
   - 点击展开 AI 解释文本
   - 置信度 < 0.5 的材料高亮提示人工复核

4. **EvaluationResult.vue** — 评分结果（重构）
   - ECharts 五维雷达图
   - 每维度展开得分明细
   - 总分大数字展示

### 置信度配色方案

| 置信度 | 颜色 | 含义 |
|--------|------|------|
| > 0.8 | 绿色 `#34A853` | AI 很确定，可以直接用 |
| 0.5 ~ 0.8 | 橙色 `#E37400` | AI 不太确定，建议人工看一眼 |
| < 0.5 | 红色 `#D93025` | AI 无法确定，必须人工复核 |

---

## 九、环境变量配置

在 `server/.env` 中添加：

```env
# DeepSeek API
DEEPSEEK_API_KEY=你的DeepSeek_API_Key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

在 `server/src/config/index.js` 中添加 DeepSeek 配置读取。

---

## 十、新增依赖

```bash
cd server
npm install mammoth xlsx docxtemplater pizzip pdf-parse
```

| 包 | 用途 |
|----|------|
| `mammoth` | 解析 .docx 文件，提取纯文本 |
| `xlsx` | 读写 Excel 文件（.xlsx/.xls） |
| `docxtemplater` + `pizzip` | 向 Word 模板填充数据，生成 .docx |
| `pdf-parse` | 解析 PDF 文件，提取纯文本 |

前端建议额外安装 ECharts：

```bash
cd client
npm install echarts
```

---

## 十一、实施顺序建议

| Phase | 内容 | 难度 | 预计时间 |
|-------|------|------|----------|
| 0 | 安装依赖、建表、配置环境变量 | ⭐ | 1h |
| 1 | 写 `aiService.js`，封装 DeepSeek API | ⭐⭐ | 1.5h |
| 2 | 写 `ruleService.js`，规则上传→AI解析 | ⭐⭐ | 2h |
| 3 | 写 `materialService.js`，材料上传→AI分析 | ⭐⭐⭐ | 3h |
| 4 | 写 `scoringService.js`，评分引擎（手写） | ⭐⭐⭐ | 2.5h |
| 5 | 写 `fillService.js`，Word 模板填充 | ⭐⭐ | 2h |
| 6 | 串联全流程 + 错误处理 + 前端打磨 | ⭐⭐ | 1.5h |

**学习要点**：
- Phase 0-1：npm 依赖管理、数据库 DDL、LLM API 调用原理
- Phase 2：文件上传全链路（前端 FormData → multer → 本地存储）、AI Prompt 工程
- Phase 3：Vision API / 多模态 AI、置信度概念、异步轮询
- **Phase 4**：核心业务逻辑，纯手写 JS 数据处理（遍历/分组/累加/排序），理解"配置驱动"
- Phase 5：模板引擎原理（模板 + 数据 = 文档）、文件生成与下载

---

## 十二、技术选型理由

| 决策 | 选择 | 理由 |
|------|------|------|
| 规则存储 | JSON 字段（不是关系表） | 规则是整体文档、AI 天然输出 JSON、不需要 SQL 查单条规则 |
| AI 调用 | 原生 `fetch`（不引入 OpenAI SDK） | 少引入依赖，DeepSeek 完全兼容 OpenAI 格式，能学到 HTTP 细节 |
| 异步处理 | `ai_tasks` 表 + 前端轮询 | 比 WebSocket 简单，够用 |
| Word 填表 | 固定占位符清单（不搞自动检测+映射） | 降低复杂度，用户按清单制作模板即可 |
| 图表 | ECharts | 国内最主流，简历加分项 |
