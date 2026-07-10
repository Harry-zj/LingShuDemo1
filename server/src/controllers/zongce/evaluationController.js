const { pool } = require("../../config/database");
const Res = require("../../utils/response");

exports.calculateScore = async (req, res) => {
  try {
    // TODO: 实际评分引擎
    const [existing] = await pool.execute("SELECT id FROM evaluation_results WHERE user_id = ?", [req.user.id]);
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
