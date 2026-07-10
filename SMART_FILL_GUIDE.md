# 智能填表（自动填表）功能 — 开发文档

## 一、功能概述

实现综测登记表的自动填表功能：用户上传 `.docx` 模板，系统使用 **docxtemplater** 引擎将评分数据填入模板中的占位符位置，产出可编辑的 Word 文件。

## 二、技术架构

```
前端 (Vue 3)
└── SmartFillForm.vue  ← 交互核心（上传/预览/填表/下载）
    ├── POST /api/zongce/templates/upload  → 上传模板
    ├── POST /api/zongce/fill/:tplId       → 一键填表
    └── GET  /api/zongce/fill/:id/download → 下载文件(blob)

后端 (Express)
├── fillController.js  ← 路由处理
├── fillService.js     ← 填充引擎 + MOCK_DATA
└── docxtemplater + pizzip → Word模板占位符替换
```

## 三、改动文件清单

| # | 文件 | 操作 | 说明 |
|---|------|------|------|
| 1 | `server/src/services/zongce/fillService.js` | **新增** | 核心填充引擎 + 完整模拟数据(MOCK_DATA) |
| 2 | `server/src/controllers/zongce/fillController.js` | **重写** | uploadTemplate/doFill/downloadFill/getMockData |
| 3 | `server/src/routes/zongce.js` | **编辑** | 新增 GET /mock-data 路由 |
| 4 | `server/src/services/zongce/db/init.sql` | **编辑** | fill_templates 增加 template_type 列；新增 fill_results 表 |
| 5 | `server/src/config/database.js` | **编辑** | 新增 fill_templates.template_type 迁移 |
| 6 | `client/src/views/zongce/SmartFillForm.vue` | **重写** | 完整交互UI（上传/预览/填表/下载/占位符指南） |
| 7 | `client/src/views/zongce/SmartFill.vue` | **编辑** | downloadFill 函数实现 blob 下载 |
| 8 | `client/src/api/zongce.js` | **编辑** | 新增 getMockData API |

## 四、模拟数据结构（MOCK_DATA）

开发期使用内置模拟数据，包含完整的 F1/F2/F3 模块：

```
张三 (学号: 2024001001, 学年: 2024-2025)

F1 基本素质（权重10%）：
  A1 思想政治 20/20 | A2 道德品质 18/20 | A3 学习态度 20/20
  A4 组织纪律 20/20 | A5 身心健康 20/20
  合计: 98 → 加权: 9.8

F2 课程学习（权重65%）：
  9门课程，加权平均分: 90.21
  加权得分: 58.64

F3 创新实践（权重25%）：
  B1 职业技能 8.0  | B2 科技学术 18.0 | B3 社会工作 6.0
  B4 宣传报道 3.0  | B5 文艺创作  0   | B6 文体竞赛 8.0
  B7 其他实践 7.5  | B8 劳育类   6.3
  合计: 56.8 → 加权: 14.2

综测总分: 82.64  等级: 优
```

## 五、占位符清单

在 Word 模板中按需插入以下 `{key}` 占位符：

### 基本信息 (5个)
| 占位符 | 说明 | 示例值 |
|--------|------|--------|
| `{real_name}` | 姓名 | 张三 |
| `{student_id}` | 学号 | 2024001001 |
| `{academic_year}` | 学年 | 2024-2025 |
| `{total_score}` | 总分 | 82.64 |
| `{grade}` | 等级 | 优 |

### F1 基本素质 (12个)
| 占位符 | 说明 | 占位符 | 说明 |
|--------|------|--------|------|
| `{F1_A1_score}` | A1得分 | `{F1_A1_detail}` | A1说明 |
| `{F1_A2_score}` | A2得分 | `{F1_A2_detail}` | A2说明 |
| `{F1_A3_score}` | A3得分 | `{F1_A3_detail}` | A3说明 |
| `{F1_A4_score}` | A4得分 | `{F1_A4_detail}` | A4说明 |
| `{F1_A5_score}` | A5得分 | `{F1_A5_detail}` | A5说明 |
| `{F1_total}` | F1合计 | `{F1_weighted}` | F1加权 |

### F2 课程学习 (3个 + 循环)
| 占位符 | 说明 |
|--------|------|
| `{F2_weighted_avg}` | 加权平均分 |
| `{F2_weighted}` | F2加权得分 |

课程表格循环（用于Word表格中自动展开）：
```
{#F2_courses}
  {name}    {credit}    {score}
{/F2_courses}
```

### F3 创新实践 (18个 + 循环)
| 占位符 | 说明 | 占位符 | 说明 |
|--------|------|--------|------|
| `{F3_B1_score}` | B1得分 | `{F3_B1_detail}` | B1明细 |
| `{F3_B2_score}` | B2得分 | `{F3_B2_detail}` | B2明细 |
| ... | ... | ... | ... |
| `{F3_B8_score}` | B8得分 | `{F3_B8_detail}` | B8明细 |
| `{F3_total}` | F3合计 | `{F3_weighted}` | F3加权 |

明细循环（用于展开每个B类的加分项）：
```
{#F3_B1_items}
  {desc}    +{score}分
{/F3_B1_items}
```

## 六、测试步骤

### 前提条件
1. 确保后端服务已启动：`cd server && npm run dev`
2. 确保前端已启动：`cd client && npm run dev`
3. 确保 MySQL 数据库 `lingshu_zongce` 已初始化
4. 使用开发账号登录：用户名 `dev`，密码 `123456`

### 测试流程

**步骤 1：进入智能填表页面**
- 访问 http://localhost:5173（前端默认端口）
- 导航到「智能填表」页面

**步骤 2：展开填表功能**
- 点击「④ 自动填表」卡片
- 由于开发期数据已内置，卡片可直接点击

**步骤 3：上传模板**
- 点击或拖拽 `.docx` 模板到上传区
- 上传成功后显示文件名和大小
- 展开「数据预览」查看将要填入的数据

**步骤 4：一键填表**
- 点击「一键填表」按钮
- 按钮显示加载动画（spinner + "正在填写中..."）
- 完成后显示「下载已填写文件」按钮

**步骤 5：下载文件**
- 点击「下载已填写文件」
- 浏览器自动下载填写完成的 `.docx` 文件
- 用 Word/WPS 打开验证填充结果

### 制作测试模板的方法

在 Word 中创建一个表格，按登记表格式放入占位符。例如：

```
姓名：{real_name}    学号：{student_id}    学年：{academic_year}

F1基本素质总分：{F1_total}    加权：{F1_weighted}
A1思想政治：{F1_A1_score}/20
说明：{F1_A1_detail}
...

F2加权平均分：{F2_weighted_avg}    加权得分：{F2_weighted}

课程名称          学分    成绩
{#F2_courses}{name}    {credit}    {score}
{/F2_courses}

总分：{total_score}    等级：{grade}
```

## 七、常见问题

**Q: 上传 .docx 文件提示"文件格式校验失败"？**
A: 您的文件可能是旧版 .doc 格式（即使扩展名是 .docx）。请用 Word/WPS 打开后，选择「另存为」→ 文件类型选择「Word 文档 (.docx)」。

**Q: 占位符没有被替换？**
A: 检查占位符格式是否正确，必须是 `{key}` 形式（花括号内无空格）。注意 docxtemplater 语法区分大小写。

**Q: 课程表格没有展开？**
A: 确保循环标签格式正确：`{#F2_courses}` 开头，`{/F2_courses}` 结尾，中间每行用 `{name}` `{credit}` `{score}` 取字段值。

**Q: 下载失败？**
A: 先确认已成功执行"一键填表"，然后再下载。

## 八、后续扩展方向

1. **对接真实数据**：`fillService.js` 中的 `getFillData()` 改为从 `evaluation_results` 表读取
2. **AI 分类归目**：在填表前增加 DeepSeek 分类步骤，将五维数据映射到 F1/F2/F3/B1-B8
3. **数据预览编辑**：允许用户在填表前手动微调模拟数据
4. **批量填表**：支持一次上传多个学生数据，批量产出行表文件
5. **Excel (.xlsx) 支持**：扩展 fillService 支持 xlsx 模板填充
