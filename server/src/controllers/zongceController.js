const { pool } = require("../config/database");
const Res = require("../utils/response");

// ============================================================
//  规则
// ============================================================

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
    res.json(Res.success(inserted, `已上传 ${inserted.length} 个文件，请等待 AI 解析`));
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
    res.json(Res.success({ id: r.insertId, status: 'pending' }, "文字规则已保存，请等待 AI 解析"));
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

// ============================================================
//  材料
// ============================================================

// 创建材料
exports.createMaterial = async (req, res) => {
  try {
    const { title } = req.body;
    const [r] = await pool.execute(
      "INSERT INTO materials (user_id, title) VALUES (?, ?)",
      [req.user.id, title || ""]
    );
    res.json(Res.success({ id: r.insertId, title: title || "", attachments: [], recognition: null }));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 获取材料列表（含附件和识别结果）
exports.getMaterials = async (req, res) => {
  try {
    const [materials] = await pool.execute(
      "SELECT * FROM materials WHERE user_id = ? ORDER BY created_at DESC",
      [req.user.id]
    );
    // 查附件
    for (const m of materials) {
      const [atts] = await pool.execute("SELECT * FROM attachments WHERE material_id = ?", [m.id]);
      m.attachments = atts;
      const [recs] = await pool.execute("SELECT * FROM material_recognitions WHERE material_id = ?", [m.id]);
      m.recognition = recs.length > 0 ? recs[0] : null;
    }
    res.json(Res.success(materials));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 上传证明文件
exports.uploadAttachments = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.files || req.files.length === 0) return res.json(Res.error("请选择文件"));
    // 验证材料存在且属于当前用户
    const [mat] = await pool.execute("SELECT id FROM materials WHERE id = ? AND user_id = ?", [id, req.user.id]);
    if (!mat.length) return res.json(Res.error("材料不存在"));
    const inserted = [];
    for (const f of req.files) {
      const [r] = await pool.execute(
        "INSERT INTO attachments (material_id, file_name, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?)",
        [id, f.originalname, f.filename, f.mimetype, f.size]
      );
      inserted.push({ id: r.insertId, file_name: f.originalname });
    }
    res.json(Res.success(inserted, `已上传 ${inserted.length} 个文件`));
  } catch (e) { res.json(Res.error(e.message)); }
};

// AI 分析材料（占位，后续接 AI）
exports.analyzeMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    // 验证材料存在
    const [mat] = await pool.execute("SELECT id, title FROM materials WHERE id = ? AND user_id = ?", [id, req.user.id]);
    if (!mat.length) return res.json(Res.error("材料不存在"));

    // TODO: 实际调 AI 服务分析附件
    // 目前返回占位结果
    const [r] = await pool.execute(
      "INSERT INTO material_recognitions (material_id, category, explanation, confidence, matched_rule_ids, confirm_status) VALUES (?, ?, ?, ?, ?, 'pending')",
      [id, "", "AI 分析功能即将上线，请手动归类", 0.5, JSON.stringify([])]
    );
    res.json(Res.success({ id: r.insertId, status: 'pending' }, "AI 分析完成（占位）"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 删除材料（级联删除附件和识别结果）
exports.deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute("DELETE FROM material_recognitions WHERE material_id = ?", [id]);
    await pool.execute("DELETE FROM attachments WHERE material_id = ?", [id]);
    await pool.execute("DELETE FROM materials WHERE id = ? AND user_id = ?", [id, req.user.id]);
    res.json(Res.success(null, "已删除"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 删除单个附件
exports.deleteAttachment = async (req, res) => {
  try {
    const { matId, attId } = req.params;
    await pool.execute("DELETE FROM attachments WHERE id = ? AND material_id = ?", [attId, matId]);
    res.json(Res.success(null, "已删除"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// ============================================================
//  识别结果确认
// ============================================================

exports.confirmRecognition = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute("UPDATE material_recognitions SET confirm_status = 'confirmed' WHERE id = ?", [id]);
    // 同步更新 materials.category
    const [rec] = await pool.execute("SELECT material_id, category FROM material_recognitions WHERE id = ?", [id]);
    if (rec.length) {
      await pool.execute("UPDATE materials SET category = ? WHERE id = ?", [rec[0].category, rec[0].material_id]);
    }
    res.json(Res.success(null, "已确认"));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.dismissRecognition = async (req, res) => {
  try {
    await pool.execute("UPDATE material_recognitions SET confirm_status = 'dismissed' WHERE id = ?", [req.params.id]);
    res.json(Res.success(null, "已舍弃"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// ============================================================
//  评分（占位，后续接手写引擎）
// ============================================================

exports.calculateScore = async (req, res) => {
  try {
    // TODO: 实际评分引擎
    // 1. 读取 confirmed 的 rule_items
    // 2. 读取 confirmed 的 material_recognitions
    // 3. 匹配 + 计算
    // 4. 写入 evaluation_results
    const [existing] = await pool.execute(
      "SELECT id FROM evaluation_results WHERE user_id = ?", [req.user.id]
    );
    if (existing.length) {
      await pool.execute("DELETE FROM evaluation_results WHERE user_id = ?", [req.user.id]);
    }
    await pool.execute(
      "INSERT INTO evaluation_results (user_id, total_score, dimension_scores) VALUES (?, 0, ?)",
      [req.user.id, JSON.stringify({})]
    );
    res.json(Res.success(null, "评分计算功能即将上线"));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.getEvaluation = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM evaluation_results WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
      [req.user.id]
    );
    res.json(Res.success(rows.length > 0 ? rows[0] : null));
  } catch (e) { res.json(Res.error(e.message)); }
};

// ============================================================
//  模板与填表（占位，后续接 docxtemplater）
// ============================================================

exports.uploadTemplate = async (req, res) => {
  try {
    if (!req.file) return res.json(Res.error("请选择文件"));
    const [r] = await pool.execute(
      "INSERT INTO fill_templates (user_id, name, file_path) VALUES (?, ?, ?)",
      [req.user.id, req.file.originalname, req.file.filename]
    );
    // 自动创建 fill_fields 预置记录
    const placeholders = [
      ['{real_name}','姓名','user.real_name'],
      ['{student_id}','学号','user.username'],
      ['{total_score}','总分','evaluation.total_score'],
      ['{moral_score}','德育得分','evaluation.moral.score'],
      ['{moral_max}','德育满分','evaluation.moral.max'],
      ['{moral_detail}','德育明细','evaluation.moral.detail_text'],
      ['{intellectual_score}','智育得分','evaluation.intellectual.score'],
      ['{intellectual_max}','智育满分','evaluation.intellectual.max'],
      ['{intellectual_detail}','智育明细','evaluation.intellectual.detail_text'],
      ['{physical_score}','体育得分','evaluation.physical.score'],
      ['{physical_max}','体育满分','evaluation.physical.max'],
      ['{physical_detail}','体育明细','evaluation.physical.detail_text'],
      ['{aesthetic_score}','美育得分','evaluation.aesthetic.score'],
      ['{aesthetic_max}','美育满分','evaluation.aesthetic.max'],
      ['{aesthetic_detail}','美育明细','evaluation.aesthetic.detail_text'],
      ['{labor_score}','劳育得分','evaluation.labor.score'],
      ['{labor_max}','劳育满分','evaluation.labor.max'],
      ['{labor_detail}','劳育明细','evaluation.labor.detail_text'],
    ];
    for (const [ph, label, src] of placeholders) {
      await pool.execute(
        "INSERT INTO fill_fields (template_id, placeholder, label, data_source) VALUES (?, ?, ?, ?)",
        [r.insertId, ph, label, src]
      );
    }
    res.json(Res.success({ id: r.insertId, name: req.file.originalname }, "模板已上传"));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.getTemplates = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM fill_templates WHERE user_id = ? ORDER BY created_at DESC",
      [req.user.id]
    );
    res.json(Res.success(rows));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.doFill = async (req, res) => {
  try {
    // TODO: 实际填表引擎
    res.json(Res.success(null, "填表功能即将上线"));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.downloadFill = async (req, res) => {
  try {
    res.json(Res.error("下载功能即将上线"));
  } catch (e) { res.json(Res.error(e.message)); }
};
