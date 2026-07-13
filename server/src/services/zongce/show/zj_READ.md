# 灵枢综测核心引擎 — 分支合并说明

> 分支：`ChenLingXiang` → 目标：`main`
> 写于 2026-07

---

## 一、这个分支做了什么

实现了**模块一的完整流水线**：上传综测规则 → AI 解析 → 上传材料 → AI 分析识别 → 自动评分 → Word 自动填表。

### 核心功能清单

| 功能 | 状态 | 说明 |
|------|------|------|
| 规则文件上传 + AI 解析 | ✅ 完成 | 支持 Word/Excel/PDF/图片，DeepSeek 流式解析，大文档自动分段并行 |
| 材料上传 + AI 识别 | ✅ 完成 | 两阶段：OCR/文本提取 → 规则匹配，输出归类+解释+置信度 |
| 规则/材料确认 | ✅ 完成 | 学生可确认或舍弃 AI 结果 |
| 评分计算 | ❌ 占位 | 接口和页面都在，但评分引擎只写了一条 TODO |
| Word 自动填表 | ❌ 占位 | 模板上传 OK，一键填表和下载是占位 |
| 用户登录 | 开发模式 | zongce 路由跳过了 JWT 校验（`middleware/devAuth.js`），自动用测试用户 |

---

## 二、新增/修改的文件

### 新增目录

```
server/src/services/zongce/     ← AI 流水线 + 数据库
  ├── ai/                       ← 7 个模块
  │   ├── aiService.js          ← DeepSeek API（流式 + OCR + 图片分析）
  │   ├── promptTemplates.js    ← Prompt 模板 V2.1.0
  │   ├── schemas.js            ← JSON Schema 校验（白名单、范围、防注入）
  │   ├── ruleParser.js         ← 规则解析入口（大文档自动分段）
  │   ├── ruleParserChunked.js  ← 大文档拆分并行解析
  │   ├── factExtractor.js      ← 事实提取（OCR→流式分析）
  │   ├── ruleMatcher.js        ← 规则匹配（代码计算置信度）
  │   └── materialService.js    ← 编排层（两阶段 + 事务）
  ├── db/init.sql               ← 建库建表 SQL（lingshu_zongce 数据库，10 张表）
  └── show/                     ← 文档
      ├── AI_PIPELINE.md        ← AI 流水线完整说明
      ├── FULL_FLOW.md          ← 数据流全链路
      ├── AI_SERVICE_GUIDE.md   ← AI 服务层教学文档
      └── zj_READ.md            ← 本文档

server/src/controllers/zongce/  ← 拆分为 5 个控制器
  ├── ruleController.js         ← 规则 CRUD + 异步解析 + SSE 进度推送
  ├── materialController.js     ← 材料 CRUD + 上传 + AI 分析触发
  ├── recognitionController.js  ← 识别结果确认/舍弃
  ├── evaluationController.js   ← 评分（TODO）
  └── fillController.js         ← 填表（TODO）

server/src/middleware/devAuth.js ← 开发模式：跳过登录，自动注入测试用户

client/src/views/zongce/        ← 前端页面（原 module1 改名）
  ├── SmartFill.vue             ← 仪表盘（4 卡片，按需刷新）
  ├── SmartFillRule.vue         ← 规则上传 + 解析进度条 + 分组确认
  ├── SmartFillMaterial.vue     ← 材料上传 + AI 识别确认
  ├── SmartFillScore.vue        ← 评分清单
  └── SmartFillForm.vue         ← 模板上传 + 填表

client/src/api/zongce.js        ← 17 个前端 API 函数
```

### 修改的已有文件

| 文件 | 改动 |
|------|------|
| `server/src/config/database.js` | **重写**：连 `lingshu_zongce` 数据库，启动自动建库建表，安全迁移 ALTER TABLE |
| `server/src/config/index.js` | 加了 `deepseek` 配置段 |
| `server/src/app.js` | 注册 `/api/zongce` 路由 |
| `server/.env` | 加了 `DEEPSEEK_API_KEY` 等环境变量 |
| `client/src/router/index.js` | `/module1/` → `/zongce/` |
| `client/src/layouts/MainLayout.vue` | 导航链接更新 |

---

## 三、合并前必须做的事

### 1. 安装新依赖

```bash
cd server && npm install
```

新增的包：`mammoth` `xlsx` `docxtemplater` `pizzip` `pdf-parse` `adm-zip`

### 2. 配置环境变量

`server/.env` 必须配置：

```env
DEEPSEEK_API_KEY=你的key
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-chat
```

### 3. 数据库

- 启动服务自动建库 `lingshu_zongce`（10 张表），**不影响原有 `lingshu` 数据库**
- 如果已有 `lingshu_zongce` 旧表，`database.js` 会自动迁移加列（`limit_value`/`scope`/`strategy`）

### 4. 恢复登录校验（上线前）

`server/src/routes/zongce.js` 第 1 行：

```js
// 当前（开发模式）：
const auth = require("../middleware/devAuth");

// 上线前改成：
const auth = require("../middleware/auth");
```

### 5. 删除开发中间件（可选）

`server/src/middleware/devAuth.js` 上线后可以删掉。

---

## 四、已知待完成

| 功能 | 位置 | 标记 |
|------|------|------|
| 评分引擎 | `controllers/zongce/evaluationController.js` | `// TODO: 实际评分引擎` |
| 填表引擎 | `controllers/zongce/fillController.js` | `// TODO: 实际填表引擎` |
| 下载填表文件 | 前后端都是占位 | `alert('下载功能待实现')` |
| 图片分析偶尔报错 | DeepSeek vision 兼容性 | 已加 try/catch 容错 |

---

## 五、技术要点（组长关注）

1. **AI 调用全部走流式**（`chatStream`），不超时。规则解析大文档自动分段并行，材料分析是先 OCR 再流式提取事实的两阶段流水线。

2. **所有 AI 输出都经过 JSON Schema 校验**（`schemas.js`）：白名单枚举、0~1 范围、禁止多余字段、虚构 rule_id 拒绝、AI 返回 score 字段会被记录违规日志后删除。

3. **分数不由 AI 决定**：AI 只返回 matched_rule_id，后端代码从数据库读 score 并计算最终置信度（`AI×0.5 + 清晰度×0.3 + 完整度×0.2`）。

4. **防 Prompt 注入**：动态数据一律放 User Message，System Prompt 不含用户数据。三段 Prompt 都有安全约束声明。

5. **事务保护**：`ruleParser.js` 和 `materialService.js` 的 DELETE+INSERT+UPDATE 都在事务里，中途失败自动回滚。

6. **规则确认后才参与评分**：`rule_items.status` 从 `pending_confirm` → `confirmed`，只有 confirmed 的规则被材料分析和评分引擎使用。
