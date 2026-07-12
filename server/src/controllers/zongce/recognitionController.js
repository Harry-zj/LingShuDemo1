const { pool } = require("../../config/database");
const Res = require("../../utils/response");

exports.confirmRecognition = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute("UPDATE material_recognitions SET confirm_status = 'confirmed' WHERE id = ?", [id]);
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

// 确认事实匹配（更新 fact_rule_matches.review_status）
exports.confirmFactMatch = async (req, res) => {
  try {
    const { id } = req.params;
    const [result] = await pool.execute(
      "UPDATE fact_rule_matches SET review_status = 'confirmed' WHERE id = ?",
      [id]
    );
    if (result.affectedRows === 0) return res.json(Res.error('匹配记录不存在'));
    res.json(Res.success(null, '已确认'));
  } catch (e) { res.json(Res.error(e.message)); }
};
