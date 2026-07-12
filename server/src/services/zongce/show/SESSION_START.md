# 新会话启动指令

## 项目

灵枢（LingShu）—— 高校综测智能计算平台。  
当前在分支 `ChenLingXiang`，负责"智能填表"模块。

## 必须先读

- `server/src/services/zongce/show/RULE_REDESIGN_V41.md` — 最终设计文档
- `server/src/services/zongce/show/AI_PARSE_FLOW.md` — 当前解析流程

## 当前状态

### 已完成（V2）
- 数据库 20 张 V2 表（init.sql 末尾，`IF NOT EXISTS`，和 V1 表共存）
- DOCX 结构提取：mammoth HTML → doc_blocks（段落/表格/标题/编号）
- 章节识别：Heading 1 或 "第X章" → 章；Heading 2-6 → 节
- V2 Prompt：AI 输出指标树（indicators）+ 规则包（packages）+ 可执行规则（executable_rules）
- 按章并行解析 → 合并去重 → 事务写入 V2 表
- 材料事实：extracted_facts + fact_sources（V2 表有数据但格式需完善）
- 评分引擎：scoringEngine.js 有 5 种执行器但未完整接入

### 没做完
- **章节识别不支持 F1/F2/F3 编号体系**（当前文档用这个格式，buildChapterTree 只认 Heading 1 或"第X章"）
- 评分引擎：Rule Application 编译 + 完整 10 阶段执行 + API 接入
- 材料事实 V2 格式：fact_data JSON 还是 V1 镜像
- 模板填表

## 文件结构

```
server/src/services/zongce/
├── ai/
│   ├── deepseek.js              ← DeepSeek API（流式/OCR/图片）
│   ├── prompts.js               ← Prompt 模板 V2.1
│   ├── schemas.js               ← JSON Schema 校验
│   ├── parsing/
│   │   ├── docStructure.js      ← DOCX 结构提取 + 章节识别
│   │   └── ruleParser.js        ← V2 规则解析主流程
│   ├── factExtractor.js         ← 材料事实提取
│   ├── ruleMatcher.js           ← 规则匹配
│   └── materialPipeline.js      ← 材料分析编排
├── engine/
│   └── scoringEngine.js         ← 评分引擎
├── db/init.sql                  ← 建库建表
└── show/                        ← 文档

server/src/controllers/zongce/   ← 按领域拆分的控制器
client/src/views/zongce/         ← 前端（SmartFill 仪表盘 + 4 子页面）
```

## 关键约定

- **不要改 Home.vue**：组长的文件
- **日志要简洁**：不要加一堆 console.log，只在关键节点留一行
- **AI 调用全走流式**（chatStream），大文档按章节拆分并行
- **所有 AI 输出必须校验**（schemas.js），AI 不返回分数
- **批量写入用事务**
- **V1 表保留**，V2 作为新流程

## 下一步

1. 修章节识别：让 `docStructure.js` 的 `isTopChapter` 支持 F1/F2 编号体系
2. 走通完整的 V2 解析（DOCX → doc_blocks → 章节 → AI → V2 表写入）
3. 接入评分引擎
