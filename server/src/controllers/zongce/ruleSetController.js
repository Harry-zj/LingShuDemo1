const { pool } = require("../../config/database");
const Res = require("../../utils/response");

// 创建规则集
exports.createRuleSet = async (req, res) => {
  try {
    const { version_label, batch_id } = req.body;
    const label = version_label || `规则集 ${new Date().toLocaleDateString('zh-CN')} ${new Date().toLocaleTimeString('zh-CN', {hour:'2-digit',minute:'2-digit'})}`;
    const [r] = await pool.execute(
      "INSERT INTO rule_sets (user_id, batch_id, version_label) VALUES (?, ?, ?)",
      [req.user.id, batch_id || null, label]
    );
    res.json(Res.success({ id: r.insertId, status: 'draft' }, "规则集已创建"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 获取规则集列表（含统计信息）
// ★ 学生：只按 batch_id 查已发布规则集（不检查 user_id）
// ★ 管理员：按 user_id + batch_id 查询自己的规则集
exports.getRuleSets = async (req, res) => {
  try {
    const isStudent = req.user.role === 'student';
    let rows;
    if (isStudent) {
      // 学生只看到已发布的规则集（按批次）
      [rows] = await pool.execute(
        `SELECT rs.*, (SELECT COUNT(*) FROM scoring_rules WHERE rule_set_id = rs.id AND status = 'active') AS f3_rule_count
         FROM rule_sets rs
         WHERE rs.status = 'published' AND (? IS NULL OR rs.batch_id = ?)
         ORDER BY rs.published_at DESC`,
        [req.query.batch_id || null, req.query.batch_id || null]
      );
    } else {
      [rows] = await pool.execute(
        `SELECT rs.*, (SELECT COUNT(*) FROM scoring_rules WHERE rule_set_id = rs.id AND status = 'active') AS f3_rule_count
         FROM rule_sets rs
         WHERE rs.user_id = ? AND (? IS NULL OR rs.batch_id = ?)
         ORDER BY rs.created_at DESC`,
        [req.user.id, req.query.batch_id || null, req.query.batch_id || null]
      );
    }
    res.json(Res.success(rows));
  } catch (e) { res.json(Res.error(e.message)); }
};

// ★ 获取指定批次已发布规则集的完整规则列表（学生端只读展示）
exports.getPublishedRules = async (req, res) => {
  try {
    const { batch_id } = req.query;
    if (!batch_id) return res.json(Res.error("缺少 batch_id"));
    const [rules] = await pool.execute(
      `SELECT sr.*, rs.version_label
       FROM scoring_rules sr
       JOIN rule_sets rs ON sr.rule_set_id = rs.id
       WHERE rs.batch_id = ? AND rs.status = 'published' AND sr.status = 'active'
       ORDER BY sr.item_key, sr.score_level, sr.score_rank`,
      [batch_id]
    );
    // 同时返回规则集基本信息
    const [ruleSets] = await pool.execute(
      "SELECT * FROM rule_sets WHERE batch_id = ? AND status = 'published' ORDER BY published_at DESC LIMIT 1",
      [batch_id]
    );
    res.json(Res.success({
      rule_set: ruleSets[0] || null,
      rules: rules,
    }));
  } catch (e) { res.json(Res.error(e.message)); }
};


// 获取规则集详情
exports.getRuleSet = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute("SELECT * FROM rule_sets WHERE id = ?", [id]);
    if (!rows.length) return res.json(Res.error("规则集不存在"));
    const rs = rows[0];
    try { const [docs] = await pool.execute("SELECT d.*, rsd.document_role, rsd.priority, rsd.merge_mode FROM rule_set_documents rsd JOIN rule_sources d ON rsd.rule_source_id = d.id WHERE rsd.rule_set_id = ?", [id]); rs.documents = docs; } catch(_) { rs.documents = []; }
    const [f3Rules] = await pool.execute("SELECT * FROM scoring_rules WHERE rule_set_id = ? ORDER BY item_key, score_level, score_rank", [id]);
    rs.f3_rules = f3Rules; rs.indicators = []; rs.packages = []; rs.lookup_tables = [];
    res.json(Res.success(JSON.parse(JSON.stringify(rs))));
  } catch (e) {
    console.error('[RuleSet] getRuleSet 失败:', e.message);
    res.json(Res.error('获取规则集详情失败: ' + e.message));
  }
};

// 关联文档到规则集
exports.addDocument = async (req, res) => {
  try {
    const { id } = req.params;
    const { rule_source_id, document_role, priority, merge_mode } = req.body;

    // 检查规则集是 draft
    const [rs] = await pool.execute("SELECT status FROM rule_sets WHERE id = ?", [id]);
    if (!rs.length) return res.json(Res.error("规则集不存在"));
    if (rs[0].status !== 'draft') return res.json(Res.error("只有 draft 状态可添加文档"));

    await pool.execute(
      `INSERT INTO rule_set_documents (rule_set_id, rule_source_id, document_role, priority, merge_mode)
       VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE document_role=VALUES(document_role), priority=VALUES(priority), merge_mode=VALUES(merge_mode)`,
      [id, rule_source_id, document_role || 'primary', priority || 0, merge_mode || 'append']
    );
    res.json(Res.success(null, "文档已关联"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 移除关联文档
exports.removeDocument = async (req, res) => {
  try {
    const { id, docId } = req.params;
    await pool.execute("DELETE FROM rule_set_documents WHERE rule_set_id = ? AND rule_source_id = ?", [id, docId]);
    res.json(Res.success(null, "已移除"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 发布规则集（★ 同批次只保留一个 published，其他自动归档）
exports.publishRuleSet = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    const [rs] = await conn.execute("SELECT * FROM rule_sets WHERE id = ?", [id]);
    if (!rs.length) { conn.release(); return res.json(Res.error("规则集不存在")); }
    if (rs[0].status === 'published') { conn.release(); return res.json(Res.error("已发布，不可重复发布")); }

    await conn.beginTransaction();
    // ★ 同批次其他 published → archived（确保只有一个生效）
    if (rs[0].batch_id) {
      await conn.execute(
        "UPDATE rule_sets SET status = 'archived' WHERE batch_id = ? AND status = 'published' AND id <> ?",
        [rs[0].batch_id, id]
      );
    }
    await conn.execute(
      "UPDATE rule_sets SET status = 'published', published_at = NOW() WHERE id = ?", [id]
    );
    await conn.commit();
    res.json(Res.success(null, "规则集已发布"));
  } catch (e) {
    await conn.rollback();
    res.json(Res.error(e.message));
  } finally { conn.release(); }
};

// 删除规则集（级联 V2 表）
exports.deleteRuleSet = async (req, res) => {
  try {
    const { id } = req.params;
    const [rs] = await pool.execute("SELECT * FROM rule_sets WHERE id = ?", [id]);
    if (!rs.length) return res.json(Res.error("规则集不存在"));
    if (rs[0].status === 'published') return res.json(Res.error("已发布的规则集不能删除"));

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // 级联删除 V2 子表
      await conn.execute("DELETE FROM scoring_rules WHERE rule_set_id = ?", [id]);
      await conn.execute("DELETE FROM rule_set_documents WHERE rule_set_id = ?", [id]);
      await conn.execute("DELETE FROM rule_sets WHERE id = ?", [id]);
      await conn.commit();
      res.json(Res.success(null, "已删除"));
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally { conn.release(); }
  } catch (e) { res.json(Res.error(e.message)); }
};

// ★ 手动添加单条规则到规则集
exports.addRule = async (req, res) => {
  try {
    const { id } = req.params;
    const { item_key, item_name, score_level, score_rank, score, keywords, description } = req.body;

    const [rs] = await pool.execute("SELECT * FROM rule_sets WHERE id = ?", [id]);
    if (!rs.length) return res.json(Res.error("规则集不存在"));
    if (rs[0].status === 'archived') return res.json(Res.error("已归档的规则集不能添加规则"));
    if (!item_key || !item_name || !score) return res.json(Res.error("类别、名称和分值为必填项"));

    await pool.execute(
      `INSERT INTO scoring_rules (rule_set_id, user_id, section, item_key, item_name, score_level, score_rank, score, keywords, description, status)
       VALUES (?, ?, 'F3', ?, ?, ?, ?, ?, ?, ?, 'active')`,
      [Number(id), req.user.id, item_key, item_name, score_level || '', score_rank || '', Number(score), keywords || '', description || '']
    );
    res.json(Res.success(null, "规则已添加"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 克隆规则集
exports.cloneRuleSet = async (req, res) => {
  try {
    const { id } = req.params;
    const [rs] = await pool.execute("SELECT * FROM rule_sets WHERE id = ?", [id]);
    if (!rs.length) return res.json(Res.error("规则集不存在"));

    const [r] = await pool.execute(
      "INSERT INTO rule_sets (user_id, batch_id, version_label, cloned_from_id) VALUES (?, ?, ?, ?)",
      [req.user.id, rs[0].batch_id || null, (rs[0].version_label || '') + ' (副本)', id]
    );
    res.json(Res.success({ id: r.insertId }, "已克隆"));
  } catch (e) { res.json(Res.error(e.message)); }
};
