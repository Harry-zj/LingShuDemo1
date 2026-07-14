# 智能填表 · 批次功能说明

---

## 一、为什么需要批次

综测是按**学年/学期**进行的（如"2025-2026 学年第一学期综测"）。每个批次的规则文件、计分规则、学生填报数据都需要隔离开来——上学期和下学期用的是不同的政策文件，加分标准也可能不同。

**批次（batch）就是这个"隔离层"**。所有核心数据通过 `batch_id` 关联到具体批次的评估批次（`assessment_batches` 表）。

---

## 二、数据流总览

```
SmartFill.vue（顶部批次选择器）
  │
  ├─ 用户选择批次 → selectedBatchId
  │
  ├─ [1] 上传规则文件
  │     POST /api/zongce/rules/upload + batch_id
  │       → rule_sources (batch_id)  ← 文件标记批次
  │
  ├─ [2] 解析规则
  │     POST /api/zongce/rules/sources/:id/parse?batch_id=X
  │       → rule_sets (batch_id)         ← 规则集标记批次
  │       → scoring_rules (batch_id)     ← 每条规则标记批次
  │
  ├─ [3] 智能填表（F1/F2/F3）
  │     → smart_fill_data (batch_id)     ← 填报缓存标记批次
  │     → assessment_forms (batch_id)    ← 综测表标记批次
  │
  ├─ [4] 材料匹配 & 计算
  │     → 按 batch_id 加载对应批次的 scoring_rules
  │     → 只匹配当前批次规则，互不干扰
  │
  └─ [5] 切换批次
        PUT /api/zongce/rules/move-batch
          → 事务批量更新 rule_sources + rule_sets + scoring_rules
          → 前一披次的规则自动迁移到新批次
```

---

## 三、涉及的数据表（新增 batch_id 列）

| 表 | batch_id 作用 |
|----|--------------|
| `assessment_batches` | 批次本身（主表），定义学年、学院、年级等 |
| `rule_sources` | 上传的规则文件属于哪个批次 |
| `rule_sets` | 解析出的规则集属于哪个批次 |
| `scoring_rules` | 每条 F3 计分规则属于哪个批次 |
| `smart_fill_data` | F1/F2/F3 填报缓存 |
| `assessment_forms` | 学生综测表 |
| `evaluation_results` | 最终评定结果 |

每个学生每个批次在 `assessment_forms` 里最多一条记录，`evaluation_results` 也按 `(user_id, batch_id)` 唯一约束。

---

## 四、前端流程

### 4.1 批次选择器

[SmartFill.vue](client/src/views/zongce/SmartFill.vue) 顶部：

```html
<select v-model="selectedBatchId" @change="onBatchChange">
  <option v-for="b in batches" :key="b.id" :value="b.id">
    {{ b.title }} ({{ b.school_year }})
  </option>
</select>
```

页面加载时自动选中第一个批次，切换批次时触发 `onBatchChange`。

### 4.2 切换批次的自动迁移

用户从"2024-2025 第一学期"切换到"2024-2025 第二学期"时：

```js
async function onBatchChange() {
  // 如果规则正在解析中，阻止切换
  if (isParsing.value) {
    alert('规则正在解析中，请等待解析完成后再切换批次')
    return  // 回滚选择
  }
  // 将旧批次的规则（rule_sources + rule_sets + scoring_rules）迁移到新批次
  if (previousBatchId && previousBatchId !== selectedBatchId) {
    await api.moveRulesBatch(previousBatchId, selectedBatchId)
  }
  previousBatchId = selectedBatchId
  await refreshAll()  // 刷新该批次下的规则、材料、填表数据
}
```

**设计意图**：用户通常在第一个批次上传并解析了规则文件，切换到新批次时，这些规则自动迁移过去，不需要重新上传解析。

### 4.3 所有请求都携带 batchId

```js
// 上传规则文件
api.uploadRuleFiles(fd, selectedBatchId)

// 解析规则
api.parseRuleSource(sourceId, selectedBatchId)

// 保存 F1/F2/F3 数据
api.saveFillData(items, selectedBatchId)

// 获取填表预览
api.getFillPreview(selectedBatchId)

// 计算综测分数
api.calculateScore(ruleSetId, materialIds, selectedBatchId)
```

---

## 五、后端关键实现

### 5.1 规则上传 → rule_sources 写入 batch_id

[ruleController.js](server/src/controllers/zongce/ruleController.js) `uploadRuleFiles`：

```js
const batchId = req.body.batch_id || req.query.batch_id || null
INSERT INTO rule_sources (user_id, batch_id, ...) VALUES (?, ?, ...)
```

### 5.2 规则解析 → rule_sets + scoring_rules 写入 batch_id

[ruleParser.js](server/src/services/zongce/ai/parsing/ruleParser.js) `parseRuleSourceV2`：

```js
async function parseRuleSourceV2(sourceId, userId, onProgress, batchId, ...) {
  // 查找或创建 rule_set，写入 batch_id
  INSERT INTO rule_sets (user_id, batch_id, version_label, status) VALUES (?, ?, ?, 'draft')

  // 写入 scoring_rules，每条都带 batch_id
  INSERT INTO scoring_rules (rule_set_id, batch_id, user_id, ...) VALUES (?, ?, ?, ...)
}
```

**复用逻辑**：同一个文件 + 同一个批次已经解析过 → 复用现有规则集，不重复创建。`forceNew=1` 可以强制新建。

### 5.3 材料匹配 → 按 batch_id 加载规则

[materialPipeline.js](server/src/services/zongce/ai/materialPipeline.js) 和 [textSimilarityMatcher.js](server/src/services/zongce/ai/textSimilarityMatcher.js)：

```js
// 按 rule_set_id（已包含 batch 信息）加载规则
SELECT ... FROM scoring_rules WHERE status = 'active' AND rule_set_id = ?
```

材料和规则必须在同一批次下才能匹配。

### 5.4 批次迁移

`PUT /api/zongce/rules/move-batch`（在 [routes/zongce.js](server/src/routes/zongce.js) 中直接实现）：

```js
// 事务批量更新三个表
await conn.execute("UPDATE rule_sources SET batch_id = ? WHERE batch_id = ?", [to, from])
await conn.execute("UPDATE rule_sets   SET batch_id = ? WHERE batch_id = ?", [to, from])
await conn.execute("UPDATE scoring_rules SET batch_id = ? WHERE batch_id = ?", [to, from])
```

### 5.5 模块三—综测表单

[module3/service.js](server/src/services/module3/service.js) 中的 `updateSmartResult` 和 `submitSmartResult`：

```js
// batch_id 是必填参数
if (!payload?.batch_id) throw new Error("请先选择综测批次")

// 按 student_id + batch_id 唯一查找表单
SELECT * FROM assessment_forms WHERE student_id = ? AND batch_id = ? FOR UPDATE
```

---

## 六、关键设计决策

1. **batch_id 下沉到每条 scoring_rules**：不依赖 `rule_set → batch_id` 的间接关联，规则可以直接按批次筛选，查询更简单
2. **切换批次自动迁移规则**：用户不用重复上传解析，降低操作成本。迁移是事务性的，不会丢数据
3. **解析中禁止切换批次**：避免正在跑 13 个 AI 任务时数据被搬走，前端直接锁住下拉框
4. **batch_id 允许为 null**：向后兼容旧数据。旧记录 batch_id IS NULL 时，查询条件 `? IS NULL AND batch_id IS NULL` 仍能匹配
5. **forceNew 参数**：同文件同批次通常复用规则集，但用户可以强制重新解析
