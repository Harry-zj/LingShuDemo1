const { pool } = require("../../config/database");
const Res = require("../../utils/response");
const { parseRuleSource } = require("../../services/zongce/ai/ruleParser");

// 上传规则文件
exports.uploadRuleFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) return res.json(Res.error("请选择文件"));
    const inserted = [];
    for (const f of req.files) {
      const [r] = await pool.execute(
        "INSERT INTO rule_sources (user_id, source_type, file_name, file_path, status) VALUES (?, 'file', ?, ?, 'pending')",
        [req.user.id, f.originalname, f.filename]
      );
      inserted.push({ id: r.insertId, file_name: f.originalname, status: 'pending' });
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

// AI 解析规则来源
exports.parseRuleSource = async (req, res) => {
  try {
    const result = await parseRuleSource(req.params.id);
    res.json(Res.success(result, `解析完成，生成 ${result.count} 条规则项`));
  } catch (e) { res.json(Res.error(e.message)); }
};
