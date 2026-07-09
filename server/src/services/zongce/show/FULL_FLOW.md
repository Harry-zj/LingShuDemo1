# 灵枢智能填表 — 完整逻辑说明

---

## 一、你不需要手动建数据库

**启动服务器就行了。** `database.js` 会自动处理一切：

```
npm run dev
  → app.js 启动
  → 调用 initDatabase()
  → 自动建库 lingshu_zongce（如果不存在）
  → 自动建所有表（如果不存在）
  → 已有数据不受任何影响
```

**init.sql 里的 `CREATE DATABASE` 是给手动执行用的备选方案**（比如在服务器上直接用 mysql 命令初始化），正常开发不需要管它。

---

## 二、启动初始化全流程

```
npm run dev
  │
  ├─ [1] app.js 加载
  │     require("./config/database") → 创建 MySQL 连接池
  │     ┌─────────────────────────────────────┐
  │     │ pool = mysql.createPool({            │
  │     │   database: "lingshu_zongce",  ★    │
  │     │   ...                               │
  │     │ })                                  │
  │     │                                     │
  │     │ 注意：此时还没连数据库，mysql2 是    │
  │     │ 懒连接，只创建了池对象，没实际连接    │
  │     └─────────────────────────────────────┘
  │
  ├─ [2] 注册路由（auth、zongce、module2、module3）
  │
  ├─ [3] app.listen(3000) → 服务器开始监听端口
  │     │
  │     └─ [4] 回调里执行 await initDatabase()
  │           │
  │           ├─ 步骤 A：建库
  │           │   用临时连接池（不指定 database）
  │           │   → CREATE DATABASE IF NOT EXISTS lingshu_zongce
  │           │   → 此时 lingshu_zongce 数据库一定存在了
  │           │
  │           ├─ 步骤 B：读 init.sql
  │           │   读取文件内容
  │           │   去掉 "CREATE DATABASE..." 和 "USE lingshu_zongce" 两句
  │           │   （因为步骤 A 已经建了库，主连接池已指定数据库，不需要这两句）
  │           │
  │           └─ 步骤 C：建表
  │               用主连接池执行剩余的 CREATE TABLE IF NOT EXISTS ...
  │               → 10 张表全部就绪
  │               → 控制台打印 "[DB] lingshu_zongce 初始化完成"
  │
  └─ [5] 服务器就绪，可以接受请求
```

### init.sql 的双重用途

| 使用方式 | 场景 | init.sql 中的作用 |
|----------|------|------------------|
| `database.js` 自动执行 | 开发时 npm run dev | CREATE DATABASE + USE 被**删除**后执行（因为代码已处理） |
| `mysql -u root -p < init.sql` | 服务器部署时手动初始化 | 完整执行，CREATE DATABASE + USE + CREATE TABLE 全部需要 |

### 为什么安全（幂等）

每次启动都执行，但：
- `CREATE DATABASE IF NOT EXISTS` → 库已存在就跳过
- `CREATE TABLE IF NOT EXISTS` → 表已存在就跳过
- **没有任何 DROP、DELETE、ALTER**
- 启动 100 次，数据不少一分

---

## 三、一次完整操作的数据流

以"上传规则文件 → 查看规则清单 → 确认规则"为例：

### Step 1：用户在 SmartFill 点上传

```
浏览器                                服务器                            MySQL
  │                                     │                                │
  ├ 选文件 "综测办法.docx"               │                                │
  ├ 点上传                              │                                │
  │                                     │                                │
  ├── POST /api/zongce/rules/upload ──→ │                                │
  │   FormData { files: [File] }        │                                │
  │                                     ├ [auth中间件] 验 JWT → req.user │
  │                                     ├ [multer] 收文件 → server/uploads/1712...docx
  │                                     ├ [controller]                    │
  │                                     │   INSERT INTO rule_sources ──→ │ 写入一行
  │                                     │   (user_id, 'file',            │ rule_sources
  │                                     │    '综测办法.docx',            │ status='pending'
  │                                     │    '1712....docx', 'pending')  │
  │                                     │                                │
  │ ←── { code:200, data:[{id:1,...}] } │                                │
  │                                     │                                │
  ├ alert("已上传 1 个文件")             │                                │
  ├ emit('refresh') → 父组件调 loadAll() │                                │
  │                                     │                                │
  ├── GET /api/zongce/rules/sources ──→ │                                │
  │                                     │   SELECT * FROM rule_sources → │ 查出刚插入的记录
  │ ←── { code:200, data:[...] }        │                                │
  │                                     │                                │
  ├── GET /api/zongce/rules/items ────→ │                                │
  │                                     │   SELECT * FROM rule_items ──→ │ 空（AI还没解析）
  │ ←── { code:200, data:[] }           │                                │
  │                                     │                                │
  ├ 界面刷新：规则来源显示 "📄 综测办法.docx | 待解析"                     │
```

### Step 2：用户确认/删除规则项

```
  ├ 勾选某条 rule_item
  ├── PUT /api/zongce/rules/items/5/toggle ──→
  │                                     │   UPDATE rule_items            │
  │                                     │   SET status='confirmed'      → 状态变更
  │                                     │   WHERE id=5
  │ ←── { code:200, data:{status:'confirmed'} }
  │
  ├ 点删除某条 rule_source
  ├── DELETE /api/zongce/rules/sources/1 ──→
  │                                     │   DELETE FROM rule_items      → 级联删除
  │                                     │   WHERE source_id=1
  │                                     │   DELETE FROM rule_sources    → 删除来源
  │                                     │   WHERE id=1
  │ ←── { code:200 }
  ├ 界面刷新
```

### Step 3：上传材料 → AI 分析

```
  ├ 点"+ 新建材料项"
  ├── POST /api/zongce/materials ──────→
  │   Body: { title: "" }               │   INSERT INTO materials       → 新行
  │ ←── { code:200, data:{id:10,...} }  │   (user_id, title='')
  │                                     │
  ├ 上传证明文件                          │
  ├── POST /api/zongce/materials/10/upload ─→
  │   FormData { files: [证书.png] }     │   multer 收文件               → server/uploads/xxx.png
  │                                     │   INSERT INTO attachments    → 新附件记录
  │ ←── { code:200 }                    │
  │                                     │
  ├ 点"AI 分析"                          │
  ├── POST /api/zongce/materials/10/analyze ─→
  │                                     │   INSERT INTO                 → 新识别记录
  │                                     │   material_recognitions       (暂为占位数据)
  │ ←── { code:200, msg:"AI分析完成" }   │   (category='',confidence=0.5)
  │                                     │
  ├ 界面刷新，看到识别结果卡片             │
  ├ 点"确认"                             │
  ├── PUT /api/zongce/recognitions/1/confirm ─→
  │                                     │   UPDATE confirm_status       → 'confirmed'
  │                                     │   UPDATE materials.category   → 同步
  │ ←── { code:200 }
```

---

## 四、关键设计决策说明

### 1. 为什么 database.js 要先用临时连接建库？

```
主连接池 pool 指定了 database: "lingshu_zongce"
  → 如果库不存在，pool.getConnection() 会失败
  → 所以必须先用不指定 database 的临时连接建库
  → 建完库后，主连接池就能正常工作了
```

### 2. 为什么 init.sql 里还有 CREATE DATABASE？

`init.sql` 设计为**可独立运行**。当你在服务器上部署时，可以直接：
```bash
mysql -u root -p < init.sql
```
这时 `CREATE DATABASE` 和 `USE` 是必须的。

而代码里用 `database.js` 自动执行时，这两句被 strip 掉，因为代码已经处理了。

### 3. 当前 AI 功能的状态

| 功能 | 状态 | 占位行为 |
|------|------|----------|
| 规则 AI 解析 | 未实现 | 上传后 status 永远是 'pending'，不会自动变成 'parsed' |
| 材料 AI 分析 | 占位 | 插入一条 category='' confidence=0.5 的占位记录 |
| 评分计算 | 占位 | 插入 total_score=0 的空结果 |
| Word 填表 | 占位 | 返回"即将上线" |

### 4. 前端的数据加载策略

前端每次操作后调 `loadAll()` 全量刷新：
```js
async function loadAll() {
  const [src, items, mats, eval, tpls] = await Promise.all([
    api.getRuleSources(),   // 规则来源
    api.getRuleItems(),     // 规则项
    api.getMaterials(),     // 材料+附件+识别
    api.getEvaluation(),    // 评分结果
    api.getTemplates(),     // 模板
  ])
  // 更新所有 ref
}
```

5 个请求**并行发出**（Promise.all），不是串行。刷新一次 ≈ 最慢的那个请求的时间。

---

## 五、文件索引

```
前端
  client/src/api/zongce.js              ← 17 个 API 函数
  client/src/views/zongce/SmartFill.vue  ← 仪表盘（状态条+4卡片）
  client/src/views/zongce/SmartFillRule.vue     ← 规则上传+审核
  client/src/views/zongce/SmartFillMaterial.vue ← 材料上传+识别确认
  client/src/views/zongce/SmartFillScore.vue    ← 评分清+维度明细
  client/src/views/zongce/SmartFillForm.vue     ← 模板上传+填表下载

后端
  server/src/app.js                              ← 注册 /api/zongce 路由
  server/src/config/database.js                  ← 连接池 + 自动初始化
  server/src/services/zongce/db/init.sql         ← 建库建表 SQL
  server/src/routes/zongce.js                    ← 17 个接口路由
  server/src/controllers/zongceController.js     ← 接口实现（CRUD真+AI占位）
```

---

## 六、一句话总结

> **启动服务器 → database.js 自动建库建表 → 前端 SmartFill 调 /api/zongce/* 接口 → controller 读写 lingshu_zongce 数据库 → 数据持久化。你不需要手动执行任何 SQL。**
