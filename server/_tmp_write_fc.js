const { pool } = require("../../config/database");
const Res = require("../../utils/response");

exports.uploadTemplate = async (req, res) => {
  try {
    if (!req.file) return res.json(Res.error("请选择文件"));
    const [r] = await pool.execute(
      "INSERT INTO fill_templates (user_id, name, file_path) VALUES (?, ?, ?)",
      [req.user.id, req.file.originalname, req.file.filename]
    );
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
