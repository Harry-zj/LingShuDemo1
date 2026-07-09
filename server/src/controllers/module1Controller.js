const { pool } = require("../config/database"); const Res = require("../utils/response");
// 获取材料列表
exports.getMaterials = async (req, res) => {
  try {
    const { batch_id } = req.query;
    let sql = "SELECT m.*, u.real_name as student_name FROM materials m JOIN users u ON m.student_id = u.id WHERE 1=1";
    const params = [];
    if (batch_id) { sql += " AND m.batch_id = ?"; params.push(batch_id); }
    sql += " ORDER BY m.created_at DESC";
    const [rows] = await pool.execute(sql, params);
    res.json(Res.success(rows));
  } catch (e) { res.json(Res.error(e.message)); }
};
// 创建材料
exports.createMaterial = async (req, res) => {
  try {
    const { batch_id, title, category } = req.body;
    const [r] = await pool.execute("INSERT INTO materials (batch_id, student_id, title, category) VALUES (?, ?, ?, ?)", [batch_id, req.user.id, title, category || ""]);
    res.json(Res.success({ id: r.insertId }, "创建成功"));
  } catch (e) { res.json(Res.error(e.message)); }
};
// 提交材料
exports.submitMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute("UPDATE materials SET status='pending_class_leader', submit_time=NOW() WHERE id=? AND student_id=?", [id, req.user.id]);
    res.json(Res.success(null, "提交成功"));
  } catch (e) { res.json(Res.error(e.message)); }
};
// 上传附件
exports.uploadAttachment = async (req, res) => {
  try {
    if (!req.file) return res.json(Res.error("请选择文件"));
    const { material_id } = req.body;
    const [r] = await pool.execute("INSERT INTO attachments (material_id, file_name, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?)", [material_id, req.file.originalname, req.file.filename, req.file.mimetype, req.file.size]);
    res.json(Res.success({ id: r.insertId, file_name: req.file.filename }, "上传成功"));
  } catch (e) { res.json(Res.error(e.message)); }
};
// AI智能匹配（预留）
exports.aiMatch = async (req, res) => {
  try { res.json(Res.success(null, "AI匹配功能待组员实现")); } catch (e) { res.json(Res.error(e.message)); }
};
// 批量填表（预留）
exports.batchFill = async (req, res) => { res.json(Res.success(null, "批量填表功能待组员实现")); };
// 对话填表（预留）
exports.chatFill = async (req, res) => { res.json(Res.success(null, "对话填表功能待组员实现")); };

