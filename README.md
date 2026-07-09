# 灵枢 - 基于多模态语义对齐的高校综测智能填写与决策平台

## 项目概述

灵枢是一个高校综测全流程管理平台，帮助学生、班干部和老师完成从材料提交、AI智能填表到个性化评定报告生成的全流程。

**技术栈：** Vue 3 + Vite（前端）| Node.js + Express + MySQL（后端）| Google Material You 设计风格

## 快速开始

### 环境要求
- Node.js >= 18
- MySQL 8.0+
- Git

### 安装与启动
```bash
git clone <仓库地址>
cd LingShuDemo1

# 安装依赖
cd server && npm install
cd ../client && npm install

# 配置数据库（编辑 server/.env）
# 启动 MySQL，创建数据库 lingshu

# 启动开发服务器
cd server && npm run dev   # 后端 → http://localhost:3000
cd client && npm run dev   # 前端 → http://localhost:5173
```

## 项目结构

```
LingShuDemo1/
├── client/                 # Vue 3 前端
│   └── src/
│       ├── api/            # 接口模块（auth, module1/2/3）
│       ├── assets/styles/  # 全局样式（variables.css, global.css）
│       ├── components/     # 共享组件（待组员实现）
│       ├── layouts/        # 布局（MainLayout, AuthLayout）
│       ├── router/         # 路由配置
│       ├── stores/         # Pinia 状态管理
│       ├── utils/          # 工具常量
│       └── views/          # 页面视图
│           ├── auth/       # 登录
│           ├── module1/    # 智能填表（SmartFill, BatchFill, ChatFill）
│           ├── module2/    # 个性评定（EvaluationResult, Profile, Report）
│           └── module3/    # 信息管理（Student, ClassLeader, Teacher端）
│
├── server/                 # Node.js 后端
│   └── src/
│       ├── config/         # 数据库配置、全局配置
│       ├── controllers/    # 控制器（业务逻辑处理）m
│       ├── middleware/     # 中间件（auth, roleCheck, upload）
│       ├── routes/         # 路由定义
│       ├── services/       # 业务逻辑层（组员实现）
│       └── utils/          # 工具（统一响应格式）
│
├── .gitignore
├── README.md               # 本文档
└── DEPLOY.md               # 云服务器部署指南
```

## 设计规范

### 色板（Google Material You）
| 角色 | 色值 | 用途 |
|------|------|------|
| 主色 | #1A73E8 | 按钮、链接、强调 |
| 背景 | #F8F9FA | 页面底色 |
| 卡片 | #FFFFFF | 白色卡片带 #DADCE0 边框 |
| 成功 | #34A853 | 通过状态、绿色标记 |
| 错误 | #D93025 | 退回/驳回、红色标记 |
| 警告 | #E37400 | 待审核、警示橙色 |
| 中性 | #9AA0A6 | 草稿状态 |

### 五维色板（模块二专用）
智育 #1A73E8 | 德育 #EA8600 | 体育 #34A853 | 美育 #9C27B0 | 劳育 #FF6D00

### 间距系统（8dp 网格）
卡片内边距 16px | 卡片间距 12px | 内容边距 24px | 最大宽度 1200px

### 圆角
大卡片 24px | 按钮胶囊 100px | 标签 8px | 中等 16px | 小型 12px

### 状态色规范
| 状态 | 文字颜色 | 背景颜色 |
|------|---------|---------|
| 草稿 | #9AA0A6 | #F1F3F4 |
| 待审核 | #E37400 | #FEF7E0 |
| 退回/驳回 | #D93025 | #FCE8E6 |
| 已通过 | #34A853 | #E6F4EA |

## Git 分支策略

```
main（部署分支 - 组长维护）
└── dev（集成分支 - 组长维护）
    ├── feature/module1-smart-fill     # 智能填表核心
    ├── feature/module1-batch-fill     # 批量填表
    ├── feature/module1-chat-fill      # 对话填表
    ├── feature/module2-evaluation     # 个性评定
    ├── feature/module2-report         # 评定报告
    ├── feature/module3-student        # 学生端
    ├── feature/module3-classleader    # 班干部端
    ├── feature/module3-teacher        # 老师端
    └── feature/module3-statistics     # 统计导出
```

### 开发流程
1. 克隆仓库 → 切换到 dev 分支
2. 创建功能分支：`git checkout -b feature/模块名`
3. 本地开发，频繁提交
4. 完成后推送分支 → 向 dev 提交 Pull Request
5. 组长审核合并到 dev → 集成测试 → 合并到 main 部署

## 任务分配

### 模块一：智能填表（核心引擎）
- SmartFill.vue：AI匹配填表主页
- BatchFill.vue：批量填表工具
- ChatFill.vue：对话式填表
- 共享组件：FileUploader（拖拽上传）、AiMatchBtn（流光按钮）、BottomSheet（底部面板）

### 模块二：个性评定
- EvaluationResult.vue：五维雷达图 + 评分明细
- PersonalProfile.vue：个人发展画像（班级对比、趋势图）
- ReportView.vue：个性化评定报告与建议

### 模块三：信息管理
- StudentDashboard.vue：学生端（倒计时、材料状态）
- ClassLeaderDesk.vue：班干部端（统计卡、审核列表）
- TeacherConsole.vue：老师端（批次管理、导出）
- BatchManage.vue：批次增删改查

### 共享组件（组员实现）
StatusBadge（状态标签）、BottomSheet（底部面板）、ConflictDialog（冲突弹窗）、LoadingSkeleton（骨架屏）

## API 接口概览

所有接口统一响应格式：`{ code: 200, msg: "操作成功", data: {...} }`

### 认证
POST /api/auth/register（注册）| POST /api/auth/login（登录）| GET|PUT /api/auth/profile

### 模块一：智能填表
GET|POST /api/module1/materials | POST /api/module1/upload | POST /api/module1/ai-match|batch-fill|chat-fill

### 模块二：个性评定
GET /api/module2/evaluation|class-stats|advice | POST /api/module2/report

### 模块三：信息管理
GET|POST /api/module3/batches | GET /api/module3/materials|pending|statistics
PUT /api/module3/materials/:id/review | POST /api/module3/export

## 代码规范
- 使用 `<script setup>` 组合式 API
- API 调用统一通过 api/ 模块（不直接调 axios）
- 严格遵循 Material You 设计规范
- 字段名：snake_case | 变量名：camelCase
- 提交信息使用中文
