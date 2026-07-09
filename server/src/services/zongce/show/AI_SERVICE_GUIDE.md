# AI 服务层 — 核心逻辑详解

> 读完这篇你会理解：LLM API 是什么、Prompt 怎么设计、JSON 怎么约束、以及 aiService.js 每一行在干什么

---

## 一、基础概念：调用 AI 到底是在干什么

### 1.1 本质就是发 HTTP 请求

调用 DeepSeek（或 OpenAI）跟调用普通后端接口没有本质区别——就是一次 HTTP POST 请求：

```
你的代码                                DeepSeek 服务器
   │                                        │
   ├── POST https://api.deepseek.com/v1/chat/completions
   │    Header: Authorization: Bearer sk-xxx
   │    Body: {
   │      model: "deepseek-chat",
   │      messages: [
   │        { role: "system", content: "你是综测规则解析器..." },
   │        { role: "user", content: "请解析以下规则：..." }
   │      ]
   │    }
   │    ──────────────────────────────────→
   │                                        │
   │                                        ├ 模型处理（黑盒）
   │                                        │
   │    ←────────────────────────────────── │
   │    { choices: [{ message: { content: "{\"dimensions\":{...}}" } }] }
   │
   ├ 拿到 response.choices[0].message.content
   ├ JSON.parse(content) → 得到结构化数据
```

**唯一区别**：普通接口返回固定格式，AI 接口返回的是"模型生成的文本"——你需要自己引导它按格式输出。

### 1.2 几个核心概念

| 概念 | 白话解释 |
|------|----------|
| **model** | 用哪个模型。`deepseek-chat` = DeepSeek 的通用模型，支持文本+图片 |
| **messages** | 发给模型的对话记录。一个数组，每条有 `role` 和 `content` |
| **role: system** | 系统提示词——设定 AI 的身份和行为。AI 不会回复这句，但会受它约束 |
| **role: user** | 用户说的话——你要 AI 处理的实际内容 |
| **role: assistant** | AI 之前的回复——多轮对话时把历史回复也传回去 |
| **temperature** | 0~2，控制随机性。0=每次回答几乎一样（适合解析），1=更有创意（适合写作）。我们做规则解析用 0.1~0.3 |
| **max_tokens** | 限制 AI 最多输出多少个 token（≈字数的 1.5 倍）。防止无限输出烧钱 |
| **response_format** | 约束输出格式。`{ type: "json_object" }` = 要求 AI 必须输出合法 JSON |

---

## 二、DeepSeek API 具体怎么调

### 2.1 接口规格

```
POST https://api.deepseek.com/v1/chat/completions
Content-Type: application/json
Authorization: Bearer {你的API_KEY}
```

**请求体**：
```json
{
  "model": "deepseek-chat",
  "messages": [
    { "role": "system", "content": "系统提示词" },
    { "role": "user", "content": "用户输入" }
  ],
  "temperature": 0.3,
  "max_tokens": 4096,
  "response_format": { "type": "json_object" }
}
```

**返回体**：
```json
{
  "id": "chatcmpl-xxx",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "{\"dimensions\":{...}}"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 500,
    "completion_tokens": 300,
    "total_tokens": 800
  }
}
```

### 2.2 图片怎么传

DeepSeek 支持图片分析（Vision）。图片以 base64 编码放在 user message 的 `content` 里：

```json
{
  "role": "user",
  "content": [
    { "type": "text", "text": "请分析这张证书图片，判断它属于哪个综测维度" },
    {
      "type": "image_url",
      "image_url": {
        "url": "data:image/png;base64,iVBORw0KGgo..."
      }
    }
  ]
}
```

**关键点**：
- 图片需要先转成 base64（`fs.readFileSync` → `buffer.toString('base64')`）
- 加上 data URI 前缀：`data:image/png;base64,` + base64串
- 多张图就加多个 `image_url` 块
- 文本内容用 `type: "text"`，图片用 `type: "image_url"`

---

## 三、aiService.js 要提供的三个方法

### 3.1 方法一：`chat(messages, options)` — 通用对话

**输入**：
```js
chat([
  { role: "system", content: "你是综测规则解析器..." },
  { role: "user", content: "请解析..." }
], { temperature: 0.3 })
```

**内部做的事**：
```
1. 拼接完整请求体 { model, messages, temperature, max_tokens, response_format }
2. 发 fetch POST 到 DeepSeek
3. 如果网络错误或 5xx → 重试（最多3次）
4. 从 response 中提取 choices[0].message.content
5. 如果 response_format 是 json_object → JSON.parse(content)
6. 返回解析后的对象
```

**为什么需要重试**：AI API 偶尔会超时或返回 500，重试是最简单的容错手段。

### 3.2 方法二：`analyzeImage(base64Image, prompt)` — 图片分析

**输入**：图片的 base64 字符串 + 分析指令

**内部做的事**：
```
1. 构造特殊的 user content：[{type:"text", text:prompt}, {type:"image_url", image_url:{url:"data:image/png;base64,..."}}]
2. 调 chat() 方法
3. 返回分析结果
```

**本质上就是调 chat()，只是 messages 的格式不同**。

### 3.3 方法三：`extractStructuredData(text, schemaDescription)` — 文本提取结构化数据

**输入**：一大段原始文本 + 期望的 JSON 结构描述

**内部做的事**：
```
1. 拼 system prompt："请从以下文本中提取结构化信息。输出格式：{schema}"
2. 调 chat() 方法，response_format: { type: "json_object" }
3. 校验返回的 JSON 是否包含必需字段
4. 返回结构化对象
```

---

## 四、最核心的部分：Prompt 设计

AI 的输出质量 80% 取决于 Prompt 写得好不好。这是你能发挥的地方。

### 4.1 规则解析的 Prompt

**目标**：把一份自然语言的综测办法文档 → 提取成 `rule_items` 数组

**System Prompt 设计思路**：

```
你是高校综测评分规则解析器。你的任务是把综测办法文档提取为结构化的规则项。

=== 输出格式 ===
你必须返回一个 JSON 对象：
{
  "rule_items": [
    {
      "category": "moral",           // 维度：moral(德育)/intellectual(智育)/physical(体育)/aesthetic(美育)/labor(劳育)
                                     // 如果规则适用于所有维度，填 null
      "description": "国家级荣誉称号",
      "level": "national",           // national/provincial/school/college，不适用则 null
      "score": 5.0,                  // 加分值，上限类规则填 null
      "rule_type": "scoring",        // scoring(加分项)/limit(上限约束)/conflict(冲突规则)
      "max_times": 1,                // 同一规则最多使用次数
      "conflict_group": "honor_title",// 互斥组名，同类项目填相同组名，不互斥则 null
      "proof_required": ["证书扫描件"]
    }
  ]
}

=== 分类规则 ===
- scoring：加分或扣分项。有明确的分值。
- limit：上限约束。如"德育总分不超过20分"、"每大类不超过30分"。这类 category 可能是 null（全局约束）或具体维度。
- conflict：冲突规则。如"同类荣誉只取最高分"、"同一项目获奖只取最高级别"。

=== 重要提示 ===
1. 一条原始规则可能拆成多条 rule_item。比如"国家级+5，省级+3，校级+1，同类取最高"要拆成 3 条 scoring + 1 条 conflict。
2. 如果规则没说互斥，不要强行加 conflict_group。
3. 如果规则没有明确分值，rule_type 应该是 limit 或 conflict。
4. level 只在 scoring 类型的加分项中有意义。
5. proof_required 从原文中推断需要什么证明材料。

=== 用户补充约束 ===
{用户的文字约束，如果有的话}
```

**User Prompt**（把文档原文贴进去）：

```
请解析以下综测规则文档：

{从 Word/Excel/PDF 提取出的原始文本}
```

**为什么这样设计**：
- System 定义"你是谁 + 输出什么格式"——这是固定的，所有请求共用
- User 放"具体解析什么"——每次不同
- 把用户的文字约束（对话框中输入的）嵌入 System Prompt，因为它是"规则"的一部分
- 要求 `response_format: { type: "json_object" }` 强制 AI 输出合法 JSON

### 4.2 材料识别的 Prompt

**目标**：给 AI 看一张证书/证明文件的图片或文本，让它判断"这属于哪个维度？匹配哪条规则？有多确定？"

**System Prompt**：

```
你是高校综测材料审核助手。根据给定的评分规则，分析学生提交的证明材料。

=== 可用规则 ===
{当前用户所有 confirmed 的 rule_items，转成 JSON}

=== 你必须返回 ===
{
  "category": "moral",
  "explanation": "该证书为共青团中央颁发的'全国优秀共青团员'，属于国家级荣誉称号，符合德育加分规则。",
  "confidence": 0.92,
  "matched_rule_ids": [3, 6]
}
```

**User Prompt**：图片的 base64 或文档提取文本

**confidence 的判断标准**（写在 System Prompt 里）：

```
置信度评分标准：
- 0.9~1.0：证书清晰、章印明确、与某条规则完全匹配
- 0.7~0.9：内容可辨、基本能匹配规则，但有些细节不确定
- 0.5~0.7：内容模糊、或匹配规则不够明确
- 低于 0.5：不要返回，改为标记 category="" confidence=0，在 explanation 里说明原因
```

**为什么要把规则 JSON 嵌进去**：AI 需要对照规则来判断"这张证书加多少分"。把规则作为上下文传给 AI，它才能做出准确判断。

---

## 五、错误处理和重试逻辑

```
async function chat(messages, options) {

  let lastError;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(DEEPSEEK_BASE_URL + "/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({ ... }),
        signal: AbortSignal.timeout(60000)  // 60秒超时
      });

      if (!response.ok) {
        // 4xx 错误（如 401 密钥错、400 参数错）不重试，直接抛
        if (response.status >= 400 && response.status < 500) {
          throw new Error(`API 请求错误: ${response.status}`);
        }
        // 5xx 错误重试
        throw new Error(`服务器错误: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;

      // 如果期望 JSON，尝试解析
      if (options.expectJson) {
        return JSON.parse(content);
      }
      return content;

    } catch (err) {
      lastError = err;
      if (attempt < 3) {
        // 等 1s / 2s / 4s 再重试（指数退避）
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }

  throw lastError;
}
```

**三种错误类型**：
| 错误 | 怎么处理 |
|------|----------|
| 网络超时 | 重试（最多3次），等 2^n 秒 |
| 5xx 服务器错误 | 重试，同上 |
| 4xx 客户端错误 | **不重试**，直接报错（密钥错重试也没用） |
| JSON 解析失败 | 不重试，记录原始返回内容供排查 |

---

## 六、aiService.js 在整个系统中的位置

```
aiService.js（底层，纯工具）
  │
  ├── 被 ruleService.js 调用
  │     ruleService 负责：取 rule_sources 的原始文本 → 拼 Prompt → 调 aiService
  │     → 解析返回的 JSON → 逐条 INSERT 到 rule_items
  │     → 更新 rule_sources.status = 'parsed'
  │
  ├── 被 materialService.js 调用
  │     materialService 负责：取材料附件 → 图片转 base64 / 文档提取文本
  │     → 加载当前用户的规则 → 拼 Prompt → 调 aiService
  │     → 解析返回的 JSON → INSERT 到 material_recognitions
  │     → 更新 attachments.ai_label
  │
  └── 被 scoringService.js 间接使用
        scoringService 不直接调 AI，但它依赖 rule_items + material_recognitions
        这两个表的数据是 AI 产出的
```

**aiService 不关心业务逻辑**。它只知道"给我 messages，我返回 AI 的回复"。  
**ruleService / materialService 负责业务逻辑**——拼 Prompt、解析结果、写数据库。

---

## 七、你需要配置的环境变量

在 `server/.env` 里加：

```env
DEEPSEEK_API_KEY=你的_API_Key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

然后在 `server/src/config/index.js` 里加读取：

```js
deepseek: {
  apiKey: process.env.DEEPSEEK_API_KEY || "",
  baseUrl: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
  model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
}
```

---

## 八、从零到一的完整调用链路

以"用户上传规则文件 → 看到规则清单"为例：

```
[1] 前端 SmartFillRule
    用户选文件 → FormData 上传
    → POST /api/zongce/rules/upload
    → controller 收文件、存附件、写 rule_sources (status='pending')

[2] 前端调 refresh → GET /api/zongce/rules/sources + GET /api/zongce/rules/items
    → 看到一条 "📄 综测办法.docx | 待解析"

[3] ★ 现在要实现的部分 ★
    ruleService.parseRuleSource(sourceId)
      │
      ├─ 从 rule_sources 读 original_text
      │   （如果是文件：用 mammoth/xlsx/pdf-parse 提取文本
      │    如果是图片：转 base64 用 Vision API）
      │
      ├─ 拼 System Prompt（规则解析器身份 + 输出格式 + 用户约束）
      ├─ 拼 User Prompt（原始文本）
      │
      ├─ 调 aiService.chat(messages, { expectJson: true })
      │   → DeepSeek 返回 { rule_items: [...] }
      │
      ├─ 遍历 rule_items 数组
      │   逐条 INSERT INTO rule_items
      │   (user_id, source_id, category, description, level, score,
      │    rule_type, max_times, conflict_group, proof_required,
      │    status='pending_confirm')
      │
      └─ UPDATE rule_sources SET status='parsed' WHERE id=sourceId

[4] 前端再次 refresh → 看到规则清单表格
    → 用户逐条勾选确认 → PUT /api/zongce/rules/items/:id/toggle
```

---

## 九、关键要点总结

1. **AI API 就是 HTTP 请求**，不要被"人工智能"吓到
2. **Prompt 是核心**，输出质量取决于你怎么引导 AI
3. **System Prompt 定义格式**，User Prompt 提供内容——分离关注点
4. **temperature 设低**（0.1~0.3），解析任务不需要创造性
5. **`response_format: { type: "json_object" }`** 强制输出 JSON，不用正则解析
6. **重试只针对网络/服务器错误**，4xx 不重试
7. **aiService 是纯工具**，不关心业务——业务逻辑在 ruleService/materialService 里
8. **图片需要 base64 编码**，加上 `data:image/xxx;base64,` 前缀
