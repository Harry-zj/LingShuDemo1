const { pool } = require("../../config/database");
const Res = require("../../utils/response");
const { analyzeMaterial } = require("../../services/zongce/ai/materialService");

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

// AI 分析材料
exports.analyzeMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await analyzeMaterial(id, req.user.id);
    res.json(Res.success(result, "AI 分析完成"));
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
