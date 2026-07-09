const { pool } = require("../config/database"); const Res = require("../utils/response");
// 创建批次
exports.createBatch = async (req, res) => {
  try {
    const { title, description, start_time, end_time, requirements } = req.body;
    const [r] = await pool.execute("INSERT INTO batches (title, description, start_time, end_time, requirements, created_by) VALUES (?, ?, ?, ?, ?, ?)", [title, description || "", start_time, end_time, requirements || "", req.user.id]);
    res.json(Res.success({ id: r.insertId }, "批次创建成功"));
  } catch (e) { res.json(Res.error(e.message)); }
};
// 获取批次列表
exports.getBatches = async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM batches ORDER BY created_at DESC");
    res.json(Res.success(rows));
  } catch (e) { res.json(Res.error(e.message)); }
};
// 更新批次状态
exports.updateBatchStatus = async (req, res) => {
  try {
    const { id } = req.params; const { status } = req.body;
    await pool.execute("UPDATE batches SET status = ? WHERE id = ?", [status, id]);
    res.json(Res.success(null, "状态更新成功"));
  } catch (e) { res.json(Res.error(e.message)); }
};
// 审核材料
exports.reviewMaterial = async (req, res) => {
  try {
    const { id } = req.params; const { action, comment } = req.body;
    const role = req.user.role;
    const statusMap = {
      class_leader: { approve: "pending_teacher", return: "returned_by_class_leader", reject: "rejected" },
      teacher: { approve: "approved", return: "returned_by_teacher", reject: "rejected" }
    };
    const newStatus = statusMap[role]?.[action];
    if (!newStatus) return res.json(Res.error("无效操作"));
    await pool.execute("UPDATE materials SET status = ? WHERE id = ?", [newStatus, id]);
    await pool.execute("INSERT INTO review_records (material_id, reviewer_id, reviewer_role, action, comment) VALUES (?, ?, ?, ?, ?)", [id, req.user.id, role, action, comment || ""]);
    res.json(Res.success(null, "审核完成"));
  } catch (e) { res.json(Res.error(e.message)); }
};
// 我的材料
exports.getMyMaterials = async (req, res) => {
  try {
    const { batch_id } = req.query;
    let sql = "SELECT * FROM materials WHERE student_id = ?"; const params = [req.user.id];
    if (batch_id) { sql += " AND batch_id = ?"; params.push(batch_id); }
    sql += " ORDER BY created_at DESC";
    const [rows] = await pool.execute(sql, params);
    res.json(Res.success(rows));
  } catch (e) { res.json(Res.error(e.message)); }
};
// 待审核列表
exports.getPendingReviews = async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT m.*, u.real_name as student_name FROM materials m JOIN users u ON m.student_id = u.id WHERE m.status = ? ORDER BY m.created_at DESC", [req.user.role === "class_leader" ? "pending_class_leader" : "pending_teacher"]);
    res.json(Res.success(rows));
  } catch (e) { res.json(Res.error(e.message)); }
};
// 统计
exports.getStatistics = async (req, res) => {
  try {
    const { batch_id } = req.query;
    const [rows] = await pool.execute("SELECT status, COUNT(*) as count FROM materials WHERE batch_id = ? GROUP BY status", [batch_id]);
    res.json(Res.success(rows));
  } catch (e) { res.json(Res.error(e.message)); }
};
// 导出Excel（预留）
exports.exportExcel = async (req, res) => { res.json(Res.success(null, "Excel导出功能待实现")); };
