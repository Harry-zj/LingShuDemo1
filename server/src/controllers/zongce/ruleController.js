const { pool } = require("../../config/database");
const Res = require("../../utils/response");
const { parseRuleSourceV2 } = require("../../services/zongce/ai/parsing/ruleParser");

// 上传规则文件
exports.uploadRuleFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.json(Res.error("请选择文件"));
    const batchId = req.body.batch_id || req.query.batch_id || null;
    const inserted = [];
    for (const f of req.files) {
      // multer 中文文件名编码修正
      const safeName = Buffer.from(f.originalname, 'latin1').toString('utf8');
      const [r] = await pool.execute(
        "INSERT INTO rule_sources (user_id, batch_id, source_type, file_name, file_path, status) VALUES (?, ?, 'file', ?, ?, 'pending')",
        [req.user.id, batchId, safeName, f.filename]
      );
      inserted.push({ id: r.insertId, file_name: safeName, status: 'pending' });
    }
    res.json(Res.success(inserted, `已上传 ${inserted.length} 个文件`));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 输入文字规则
exports.addRuleText = async (req, res) => {
  try {
    const { text, batch_id } = req.body;
    if (!text || !text.trim()) return res.json(Res.error("请输入文字"));
    const [r] = await pool.execute(
      "INSERT INTO rule_sources (user_id, batch_id, source_type, original_text, status) VALUES (?, ?, 'text', ?, 'pending')",
      [req.user.id, batch_id || null, text.trim()]
    );
    res.json(Res.success({ id: r.insertId, status: 'pending' }, "文字规则已保存"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 获取规则来源列表
exports.getRuleSources = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT rs.id, rs.source_type, rs.file_name, rs.status, rs.created_at,
        (SELECT at2.id FROM ai_tasks at2 WHERE at2.target_type='rule_parse' AND at2.target_id=rs.id AND at2.status='processing' LIMIT 1) AS active_task_id
       FROM rule_sources rs WHERE rs.user_id = ?` + (req.query.batch_id ? " AND rs.batch_id = ?" : "") + " ORDER BY rs.created_at DESC",
      req.query.batch_id ? [req.user.id, req.query.batch_id] : [req.user.id]
    );
    res.json(Res.success(rows));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 删除规则来源（事务级联删除）
exports.deleteRuleSource = async (req, res) => {
  const { id } = req.params;
  const conn = await pool.getConnection();
  try {
    // 1. 查关联信息
    const [sources] = await conn.execute("SELECT * FROM rule_sources WHERE id = ? AND user_id = ?", [id, req.user.id]);
    if (!sources.length) return res.json(Res.error("规则来源不存在"));
    const source = sources[0];

    // 2. 找关联的 rule_set，已发布的不让删
    const [docs] = await conn.execute(
      "SELECT rsd.rule_set_id, rs.status FROM rule_set_documents rsd JOIN rule_sets rs ON rs.id = rsd.rule_set_id WHERE rsd.rule_source_id = ?", [id]
    );
    const published = docs.find(d => d.status === 'published');
    if (published) { conn.release(); return res.json(Res.error("该文件关联的规则集已发布，不能删除。如需删除请先归档或联系管理员处理。")); }
    const ruleSetIds = docs.map(d => d.rule_set_id);

    await conn.beginTransaction();

    // 3. 级联删除 scoring_rules
    if (ruleSetIds.length) {
      await conn.execute(`DELETE FROM scoring_rules WHERE rule_set_id IN (${ruleSetIds.map(() => '?').join(',')})`, ruleSetIds);
    }
    // 4. 删除 rule_set_documents
    await conn.execute("DELETE FROM rule_set_documents WHERE rule_source_id = ?", [id]);
    // 5. 删除关联的 rule_sets（已无文档关联的）
    if (ruleSetIds.length) {
      await conn.execute(`DELETE FROM rule_sets WHERE id IN (${ruleSetIds.map(() => '?').join(',')})`, ruleSetIds);
    }
    // 6. 删除 doc_blocks
    await conn.execute("DELETE FROM doc_blocks WHERE rule_source_id = ?", [id]);
    // 7. 删除 document_parse_runs
    await conn.execute("DELETE FROM document_parse_runs WHERE rule_source_id = ?", [id]);
    // 8. 删除 ai_tasks（rule_parse 类型）
    await conn.execute("DELETE FROM ai_tasks WHERE target_type = 'rule_parse' AND target_id = ?", [id]);
    // 9. 删除 rule_sources 本身
    await conn.execute("DELETE FROM rule_sources WHERE id = ?", [id]);

    await conn.commit();

    // 10. 删除物理文件
    if (source.file_path) {
      const fs = require("fs");
      const filePath = require("path").join(__dirname, "../../../uploads", source.file_path);
      try { fs.unlinkSync(filePath); } catch (_) { /* 文件可能已不存在 */ }
    }

    res.json(Res.success(null, "已删除"));
  } catch (e) {
    await conn.rollback();
    res.json(Res.error(e.message));
  } finally {
    conn.release();
  }
};

const activeParses = new Map();

// AI 解析规则来源（异步，返回 task_id）
exports.parseRuleSource = async (req, res) => {
  try {
    // 创建任务
    const [r] = await pool.execute(
      "INSERT INTO ai_tasks (target_type, target_id, status) VALUES ('rule_parse', ?, 'processing')",
      [req.params.id]
    );
    const taskId = r.insertId;

    const cancelToken = { cancelled: false, controller: new AbortController() };
    activeParses.set(taskId, cancelToken);

    runParseV2InBackground(taskId, req.params.id, req.user.id, req.query.batch_id, cancelToken, req.query.force_new === '1');

    res.json(Res.success({ taskId }, "解析任务已启动"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 查询解析进度
exports.getParseProgress = async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM ai_tasks WHERE id = ?", [req.params.taskId]);
    if (!rows.length) return res.json(Res.error("任务不存在"));
    res.json(Res.success(rows[0]));
  } catch (e) { res.json(Res.error(e.message)); }
};

// SSE 流式推送解析进度
// 取消解析任务
exports.cancelParse = async (req, res) => {
  try {
    const taskId = parseInt(req.params.taskId);
    const token = activeParses.get(taskId);
    if (!token) return res.json(Res.error('任务不存在或已完成'));
    token.cancelled = true;
    token.controller.abort();
    await pool.execute('UPDATE ai_tasks SET status = "cancelled", error_msg = "用户取消" WHERE id = ?', [taskId]);
    res.json(Res.success(null, '已取消'));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.streamParseProgress = async (req, res) => {
  const taskId = req.params.taskId;

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);

  const timer = setInterval(async () => {
    try {
      const [rows] = await pool.execute("SELECT * FROM ai_tasks WHERE id = ?", [taskId]);
      if (!rows.length) {
        send("error", { msg: "任务不存在" });
        clearInterval(timer);
        res.end();
        return;
      }
      const task = rows[0];

      if (task.status === "completed") {
        let progress = {};
        try { progress = typeof task.result === "string" ? JSON.parse(task.result) : (task.result || {}); } catch (e) {}
        send("done", progress);
        clearInterval(timer);
        res.end();
      } else if (task.status === "failed" || task.status === "cancelled") {
        send("error", { msg: task.error_msg || (task.status === "cancelled" ? "用户取消" : "解析失败") });
        clearInterval(timer);
        res.end();
      } else {
        let progress = { completed: 0, total: 1, phase: "parsing" };
        try { if (task.result) progress = typeof task.result === "string" ? JSON.parse(task.result) : task.result; } catch (e) {}
        send("progress", progress);
      }
    } catch (e) {
      send("error", { msg: e.message });
      clearInterval(timer);
      res.end();
    }
  }, 1000);

  req.on("close", () => { clearInterval(timer); });
};

async function runParseV2InBackground(taskId, sourceId, userId, batchId, cancelToken, forceNew) {
  console.log(`[V2Parse] 开始解析 sourceId=${sourceId} userId=${userId} taskId=${taskId}`);

  // 进度回调：更新 ai_tasks.result 供 SSE 轮询
  const reportProgress = async (phase, detail) => {
    try {
      await pool.execute(
        "UPDATE ai_tasks SET result = ? WHERE id = ?",
        [JSON.stringify({ phase, ...detail, _ts: Date.now() }), taskId]
      );
    } catch (_) { /* 进度更新失败不阻塞主流程 */ }
  };

  try {
    const result = await parseRuleSourceV2(sourceId, userId, reportProgress, batchId, cancelToken, forceNew);
    console.log(`[V2Parse] 解析成功: ${JSON.stringify(result)}`);
    await pool.execute(
      "UPDATE ai_tasks SET status = 'completed', result = ? WHERE id = ? AND status <> 'cancelled'",
      [JSON.stringify({ ...result, done: true }), taskId]
    );
  } catch (e) {
    console.error(`[V2Parse] 解析失败:`, e.message, e.stack);
    await pool.execute(
      "UPDATE ai_tasks SET status = ?, error_msg = ? WHERE id = ?",
      [(e.message === "CANCELLED" ? "cancelled" : "failed"), (e.message === "CANCELLED" ? "用户取消" : e.message).slice(0, 1000), taskId]
    );
  }
}
