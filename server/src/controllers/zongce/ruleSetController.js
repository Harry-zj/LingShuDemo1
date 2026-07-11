const { pool } = require("../../config/database");
const Res = require("../../utils/response");

// 创建规则集
exports.createRuleSet = async (req, res) => {
  try {
    const { version_label } = req.body;
    const [r] = await pool.execute(
      "INSERT INTO rule_sets (user_id, version_label) VALUES (?, ?)",
      [req.user.id, version_label || ""]
    );
    res.json(Res.success({ id: r.insertId, status: 'draft' }, "规则集已创建"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 获取规则集列表（含统计信息）
exports.getRuleSets = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT rs.*,
        (SELECT COUNT(*) FROM indicator_nodes WHERE rule_set_id = rs.id) AS indicator_count,
        (SELECT COUNT(*) FROM rule_packages WHERE rule_set_id = rs.id) AS package_count,
        (SELECT COUNT(*) FROM executable_rules er
         JOIN rule_packages rp ON er.package_id = rp.id
         WHERE rp.rule_set_id = rs.id) AS rule_count,
        (SELECT COUNT(*) FROM lookup_tables WHERE rule_set_id = rs.id) AS lookup_count
       FROM rule_sets rs
       WHERE rs.user_id = ?
       ORDER BY rs.created_at DESC`,
      [req.user.id]
    );
    res.json(Res.success(rows));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 获取规则集详情
exports.getRuleSet = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.execute("SELECT * FROM rule_sets WHERE id = ?", [id]);
    if (!rows.length) return res.json(Res.error("规则集不存在"));
    const rs = rows[0];

    // 关联文档
    const [docs] = await pool.execute(
      `SELECT d.*, rsd.document_role, rsd.priority, rsd.merge_mode
       FROM rule_set_documents rsd
       JOIN rule_sources d ON rsd.rule_source_id = d.id
       WHERE rsd.rule_set_id = ?`, [id]
    );
    rs.documents = docs;

    // 解析结果：indicators / packages / rules / lookup_tables
    const [indicators] = await pool.execute(
      "SELECT * FROM indicator_nodes WHERE rule_set_id = ? ORDER BY sort_order, id", [id]
    );
    const [packages] = await pool.execute(
      "SELECT * FROM rule_packages WHERE rule_set_id = ?", [id]
    );
    const [rules] = await pool.execute(
      `SELECT er.* FROM executable_rules er
       JOIN rule_packages rp ON er.package_id = rp.id
       WHERE rp.rule_set_id = ?`, [id]
    );
    const [lookups] = await pool.execute(
      `SELECT lt.* FROM lookup_tables lt WHERE lt.rule_set_id = ?`, [id]
    );

    // 嵌套：indicator tree + packages 挂 rules
    const indicatorMap = new Map();
    for (const ind of indicators) {
      ind.children = [];
      indicatorMap.set(ind.id, ind);
    }
    const roots = [];
    for (const ind of indicators) {
      if (ind.parent_id && indicatorMap.has(ind.parent_id)) {
        indicatorMap.get(ind.parent_id).children.push(ind);
      } else {
        roots.push(ind);
      }
    }

    const pkgMap = new Map();
    for (const pkg of packages) {
      pkg.rules = [];
      pkgMap.set(pkg.id, pkg);
    }
    for (const r of rules) {
      if (pkgMap.has(r.package_id)) {
        pkgMap.get(r.package_id).rules.push(r);
      }
    }

    rs.indicators = roots;
    rs.packages = Array.from(pkgMap.values());
    rs.lookup_tables = lookups;

    res.json(Res.success(rs));
  } catch (e) { res.json(Res.error(e.message)); }
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

// 发布规则集
exports.publishRuleSet = async (req, res) => {
  try {
    const { id } = req.params;
    const [rs] = await pool.execute("SELECT * FROM rule_sets WHERE id = ?", [id]);
    if (!rs.length) return res.json(Res.error("规则集不存在"));
    if (rs[0].status === 'published') return res.json(Res.error("已发布，不可重复发布"));

    await pool.execute(
      "UPDATE rule_sets SET status = 'published', published_at = NOW() WHERE id = ?", [id]
    );
    res.json(Res.success(null, "规则集已发布"));
  } catch (e) { res.json(Res.error(e.message)); }
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
      await conn.execute("DELETE FROM executable_rules WHERE package_id IN (SELECT id FROM rule_packages WHERE rule_set_id = ?)", [id]);
      await conn.execute("DELETE FROM rule_packages WHERE rule_set_id = ?", [id]);
      await conn.execute("DELETE FROM lookup_cells WHERE table_id IN (SELECT id FROM lookup_tables WHERE rule_set_id = ?)", [id]);
      await conn.execute("DELETE FROM lookup_dimensions WHERE table_id IN (SELECT id FROM lookup_tables WHERE rule_set_id = ?)", [id]);
      await conn.execute("DELETE FROM lookup_tables WHERE rule_set_id = ?", [id]);
      await conn.execute("DELETE FROM indicator_nodes WHERE rule_set_id = ?", [id]);
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

// 克隆规则集
exports.cloneRuleSet = async (req, res) => {
  try {
    const { id } = req.params;
    const [rs] = await pool.execute("SELECT * FROM rule_sets WHERE id = ?", [id]);
    if (!rs.length) return res.json(Res.error("规则集不存在"));

    const [r] = await pool.execute(
      "INSERT INTO rule_sets (user_id, version_label, cloned_from_id) VALUES (?, ?, ?)",
      [req.user.id, (rs[0].version_label || '') + ' (副本)', id]
    );
    res.json(Res.success({ id: r.insertId }, "已克隆"));
  } catch (e) { res.json(Res.error(e.message)); }
};
