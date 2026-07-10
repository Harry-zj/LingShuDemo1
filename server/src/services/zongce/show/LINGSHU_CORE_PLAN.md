# 灵枢 - 核心引擎设计文档 v1

> v1 范围：**个人综测计算 + 自动填表工具**
> v2 迭代：邀请码、多人协作、审核流程、规则演进

---

## 一、v1 核心流程

```
用户打开"智能填表"页面
  │
  ├─ [1] 上传规则
  │     支持：Word / Excel / PDF / 图片 / 对话框输入文字
  │     → AI 自动解析为 rule_items（逐条规则项）
  │
  ├─ [2] 确认规则表
  │     AI 解析后输出简化的规则表
  │     用户逐条查看，可以：确认 / 删除 / 手动添加
  │     → 只有 confirmed 的规则参与后续评分
  │     → 也可以跳过这步，直接去上传材料（后续再回来确认）
  │
  ├─ [3] 上传材料
  │     上传证明文件（图片 / PDF / Word）
  │     → AI 自动识别 → 生成识别文段（归类 + 解释说明 + 置信度）
  │
  ├─ [4] 确认识别结果
  │     学生逐条查看 AI 识别文段
  │     可以：确认(confirmed) / 舍弃(dismissed)
  │     → 低置信度预警提示
  │
  ├─ [5] 自动算分
  │     纯 JS 引擎，confirmed规则 × confirmed材料 → 五维得分
  │
  └─ [6] 自动填表
         上传 Word 模板 → 一键填充 → 下载
```

**v1 不做**：邀请码、工作台、多人协作、审核流程（这些是 v2）

---

## 二、数据库设计

### 数据库：lingshu_zongce

独立数据库，建库脚本在 `server/db/init.sql`，app 启动时自动执行。

### 完整 ER 图（v1）

```
users（用户）
  │
  ├── 1:N ── rule_sources（规则来源）──── NEW
  │            上传的原始文件/文字记录
  │            status: pending → parsed
  │            │
  │            └── 1:N ── rule_items（规则项）──── NEW ★核心★
  │                        AI解析后的每一条具体规则
  │                        rule_type: scoring / limit / conflict
  │                        category: moral/.../NULL(全局)
  │                        status: pending_confirm → confirmed
  │
  ├── 1:N ── materials（材料）────────── NEW
  │           │
  │           ├── 1:N ── attachments（证明文件）NEW
  │           │
  │           └── 1:1 ── material_recognitions NEW ★核心★
  │                       归类 + 解释说明 + 置信度
  │                       学生确认: pending → confirmed/dismissed
  │
  ├── 1:1 ── evaluation_results ──────── NEW
  │           总分 + 五维明细(dimension_scores JSON)
  │
  └── 1:N ── fill_templates ──────────── NEW
              │
              └── 1:N ── fill_fields ── NEW
              ＋ ai_tasks ──────────── NEW
```

### 十张表速览

| 表 | 用途 | 关键字段 |
|----|------|----------|
| `users` | 用户 | |
| `rule_sources` | 上传的原始规则文件/文字 | source_type(file/text), original_text, status |
| `rule_items` | ★ AI解析后的逐条规则 | category(NULL=全局), description, level, score, **rule_type**(scoring/limit/conflict), conflict_group, status |
| `materials` | 材料 | title |
| `attachments` | 证明文件 | file_path, ai_label |
| `material_recognitions` | ★ AI识别文段 | category, **explanation**, matched_rule_ids, **confidence**, **confirm_status**(pending/confirmed/dismissed) |
| `evaluation_results` | 评定结果 | total_score, **dimension_scores**(JSON含detail_text) |
| `fill_templates` | Word模板 | file_path |
| `fill_fields` | 占位符映射 | placeholder, data_source |
| `ai_tasks` | AI任务状态 | target_type, status |

### key 设计要点

**rule_items 的三种类型**：

| rule_type | 含义 | 示例 | category | score |
|-----------|------|------|----------|-------|
| `scoring` | 加分项 | "国家级荣誉称号+5" | moral | 5.0 |
| `limit` | 上限约束 | "每大类上限30分" | NULL | NULL |
| `conflict` | 冲突规则 | "同类荣誉只取最高分" | NULL | NULL |

**规则不需要置信度**——规则是用户确认后的权威定义，AI 只是帮忙从文件中提取。

**置信度只在 material_recognitions 中使用**——代表 AI 对材料归类判断的确定性，供学生自己参考决策。

---

## 三、API 接口（v1 精简版）

```
POST   /api/rules/upload       上传规则文件(支持多文件)
POST   /api/rules/text         对话框输入文字规则
GET    /api/rules              我的规则列表
GET    /api/rules/:id          规则详情（含 structured_rules）
DELETE /api/rules/:id          删除规则

POST   /api/materials                    创建材料（已有）
POST   /api/materials/:id/upload          上传证明文件（已有）
POST   /api/materials/:id/analyze         触发AI分析 → 生成识别文段
GET    /api/materials/:id/recognition     查看识别文段
PUT    /api/materials/:id/confirm         确认识别结果（confirmed / dismissed）

POST   /api/evaluation/calculate          触发评分计算
GET    /api/evaluation/result             查看评定结果

POST   /api/templates/upload              上传Word模板
GET    /api/templates                     模板列表
POST   /api/fill                           一键填表 → 返回下载链接
```

---

## 四、前端页面（先改智能填表）

### 智能填表页面 SmartFill.vue — 重构为三栏布局

```
┌─────────────────────────────────────────────────────────┐
│  智能填表                                                  │
├──────────────┬──────────────────────┬────────────────────┤
│  ① 规则区     │  ② 材料区             │  ③ 识别确认区        │
│              │                      │                    │
│  [上传文件]   │  [+ 创建材料]         │  待确认列表:         │
│  支持:        │  [上传证明文件]        │                    │
│  .docx .xlsx │                      │  ┌──────────────┐  │
│  .pdf .png   │  ┌────────────────┐  │  │ 材料: 荣誉证书  │  │
│  .jpg        │  │ 材料1: 荣誉证书  │  │  │ 归类: 德育     │  │
│              │  │ 状态: 已分析    │  │  │ 解释: 该证书为 │  │
│  ┌─────────┐ │  │ 置信度: 92% 🟢 │  │  │ 全国优秀共青...│  │
│  │对话框    │ │  └────────────────┘  │  │ 置信度: 92% 🟢 │  │
│  │输入文字  │ │                      │  │              │  │
│  │约束规则  │ │  ┌────────────────┐  │  │ [确认] [舍弃] │  │
│  │         │ │  │ 材料2: 志愿者证明│  │  └──────────────┘  │
│  │[发送]   │ │  │ 状态: 待分析    │  │                    │
│  └─────────┘ │  └────────────────┘  │  ┌──────────────┐  │
│              │                      │  │ 材料: 志愿者证明│  │
│  已有规则:    │                      │  │ 归类: 劳育     │  │
│  📄 综测办法  │                      │  │ 解释: ...     │  │
│  📝 文字补充1 │                      │  │ 置信度: 45% 🔴 │  │
│  📝 文字补充2 │                      │  │ ⚠️ 低置信度预警 │  │
│              │                      │  │ [确认] [舍弃] │  │
│              │                      │  └──────────────┘  │
├──────────────┴──────────────────────┴────────────────────┤
│  [计算评分]                              [上传模板填表]     │
└─────────────────────────────────────────────────────────┘
```

**三栏说明**：

| 栏 | 功能 |
|----|------|
| ① 规则区 | 多文件拖拽上传 + 对话框输入文字规则 + 已有规则列表（可删） |
| ② 材料区 | 创建材料 + 上传证明文件 + 材料卡片列表（显示分析状态和置信度色标） |
| ③ 识别确认区 | 待确认的AI识别文段列表，每条显示归类+解释+置信度，两个按钮：**确认** / **舍弃** |

**对话框的定位**：不是聊天，是一个小的文字输入框，用户输入自然语言约束规则（如"志愿活动都归德育"），发给 AI 作为规则补充。

---

## 五、待办

- [ ] 你确认数据库设计
- [ ] 改 SmartFill.vue 前端 → 三栏布局
- [ ] Phase 0: 装依赖 + 建表 + .env
- [ ] Phase 1: aiService.js
- [ ] Phase 2-5: 规则解析 → 材料分析 → 评分 → 填表
