const { pool } = require("../../config/database");
const Res = require("../../utils/response");
const { parseRuleSource } = require("../../services/zongce/ai/ruleParser");

// 上传规则文件
exports.uploadRuleFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.json(Res.error("请选择文件"));
    const inserted = [];
    for (const f of req.files) {
      // multer 中文文件名编码修正
      const safeName = Buffer.from(f.originalname, 'latin1').toString('utf8');
      const [r] = await pool.execute(
        "INSERT INTO rule_sources (user_id, source_type, file_name, file_path, status) VALUES (?, 'file', ?, ?, 'pending')",
        [req.user.id, safeName, f.filename]
      );
      inserted.push({ id: r.insertId, file_name: safeName, status: 'pending' });
    }
    res.json(Res.success(inserted, `已上传 ${inserted.length} 个文件`));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 输入文字规则
exports.addRuleText = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) return res.json(Res.error("请输入文字"));
    const [r] = await pool.execute(
      "INSERT INTO rule_sources (user_id, source_type, original_text, status) VALUES (?, 'text', ?, 'pending')",
      [req.user.id, text.trim()]
    );
    res.json(Res.success({ id: r.insertId, status: 'pending' }, "文字规则已保存"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 获取规则来源列表
exports.getRuleSources = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, source_type, file_name, status, created_at FROM rule_sources WHERE user_id = ? ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json(Res.success(rows));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 获取规则项列表
exports.getRuleItems = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM rule_items WHERE user_id = ? ORDER BY category, rule_type, id",
      [req.user.id]
    );
    res.json(Res.success(rows));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 切换规则项确认状态
exports.toggleRuleItem = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute("SELECT status FROM rule_items WHERE id = ? AND user_id = ?", [id, req.user.id]);
    if (!rows.length) return res.json(Res.error("规则项不存在"));
    const newStatus = rows[0].status === 'confirmed' ? 'pending_confirm' : 'confirmed';
    await pool.execute("UPDATE rule_items SET status = ? WHERE id = ?", [newStatus, id]);
    res.json(Res.success({ status: newStatus }));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 删除规则来源（级联删除其 rule_items）
exports.deleteRuleSource = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute("DELETE FROM rule_items WHERE source_id = ? AND user_id = ?", [id, req.user.id]);
    await pool.execute("DELETE FROM rule_sources WHERE id = ? AND user_id = ?", [id, req.user.id]);
    res.json(Res.success(null, "已删除"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 删除规则项
exports.deleteRuleItem = async (req, res) => {
  try {
    await pool.execute("DELETE FROM rule_items WHERE id = ? AND user_id = ?", [req.params.id, req.user.id]);
    res.json(Res.success(null, "已删除"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// AI 解析规则来源（异步，返回 task_id）
exports.parseRuleSource = async (req, res) => {
  try {
    // 创建任务
    const [r] = await pool.execute(
      "INSERT INTO ai_tasks (target_type, target_id, status) VALUES ('rule_parse', ?, 'processing')",
      [req.params.id]
    );
    const taskId = r.insertId;

    // 后台执行（不 await），通过 ai_tasks 表追踪进度
    runParseInBackground(taskId, req.params.id);

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
      } else if (task.status === "failed") {
        send("error", { msg: task.error_msg || "解析失败" });
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

async function runParseInBackground(taskId, sourceId) {
  try {
    const result = await parseRuleSource(sourceId, (progress) => {
      pool.execute("UPDATE ai_tasks SET result = ? WHERE id = ?",
        [JSON.stringify(progress), taskId]);
    });
    await pool.execute(
      "UPDATE ai_tasks SET status = 'completed', result = ? WHERE id = ?",
      [JSON.stringify({ ...result, done: true }), taskId]
    );
  } catch (e) {
    await pool.execute(
      "UPDATE ai_tasks SET status = 'failed', error_msg = ? WHERE id = ?",
      [e.message, taskId]
    );
  }
}
