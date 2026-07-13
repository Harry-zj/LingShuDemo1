const fs = require("fs");
const path = require("path");
const { pool } = require("../../config/database");
const Res = require("../../utils/response");
const { fillDocx, getFillData, getFillDataPreview } = require("../../services/zongce/fillService");
const { analyzeAndFill: smartFill } = require("../../services/zongce/templateAnalyzer");

exports.uploadTemplate = async (req, res) => {
  try {
    if (!req.file) return res.json(Res.error("请选择文件"));
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== ".docx") {
      fs.unlink(req.file.path, () => {});
      return res.json(Res.error("仅支持 .docx 格式的 Word 模板"));
    }
    const buf = fs.readFileSync(req.file.path);
    const safeName = Buffer.from(req.file.originalname, 'latin1').toString('utf8');
    if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
      fs.unlink(req.file.path, () => {});
      return res.json(Res.error("文件格式无效，请上传真正的 .docx 文件"));
    }
    let r;
    try {
      [r] = await pool.execute(
        "INSERT INTO fill_templates (user_id, name, file_path, template_type) VALUES (?, ?, ?, ?)",
        [req.user.id, safeName, req.file.filename, "docx"]
      );
    } catch (e) {
      [r] = await pool.execute(
        "INSERT INTO fill_templates (user_id, name, file_path) VALUES (?, ?, ?)",
        [req.user.id, safeName, req.file.filename]
      );
    }
    res.json(Res.success({ id: r.insertId, name: safeName, size: req.file.size }, "模板上传成功"));
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

// ★ 删除模板（同时删除关联的填充结果）
exports.deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const [tpls] = await pool.execute(
      "SELECT * FROM fill_templates WHERE id = ? AND user_id = ?", [id, req.user.id]
    );
    if (!tpls.length) return res.json(Res.error("模板不存在"));
    // 删除模板文件
    const tpl = tpls[0];
    const tplPath = path.join(__dirname, "../../../uploads", tpl.file_path);
    try { fs.unlinkSync(tplPath); } catch (_) {}
    // 删除关联的填充结果
    const [results] = await pool.execute(
      "SELECT result_path FROM fill_results WHERE template_id = ?", [id]
    );
    for (const r of results) {
      const rpath = path.join(__dirname, "../../../uploads", r.result_path);
      try { fs.unlinkSync(rpath); } catch (_) {}
    }
    await pool.execute("DELETE FROM fill_results WHERE template_id = ?", [id]);
    await pool.execute("DELETE FROM fill_templates WHERE id = ?", [id]);
    res.json(Res.success(null, "模板已删除"));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.doFill = async (req, res) => {
  try {
    const { templateId } = req.params;
    const [tplRows] = await pool.execute(
      "SELECT * FROM fill_templates WHERE id = ? AND user_id = ?",
      [templateId, req.user.id]
    );
    if (tplRows.length === 0) return res.json(Res.error("模板不存在"));
    const tpl = tplRows[0];
    const templatePath = path.join(__dirname, "../../../uploads", tpl.file_path);
    if (!fs.existsSync(templatePath)) return res.json(Res.error("模板文件丢失，请重新上传"));

    // ★ 从数据库获取当前用户的真实填表数据
    const batchId = Number(req.query.batch_id || 0) || null;
    const fillData = await getFillData(req.user.id, batchId);

    const templateBuffer = fs.readFileSync(templatePath);
    const outputBuffer = smartFill(templateBuffer, fillData);
    const outputFileName = "filled_" + Date.now() + "_" + tpl.file_path;
    const outputPath = path.join(__dirname, "../../../uploads", outputFileName);
    fs.writeFileSync(outputPath, outputBuffer);
    let fillResultId;
    try {
      const namePart = tpl.name.replace(/.docx$/i, "");
      const [fr] = await pool.execute(
        "INSERT INTO fill_results (user_id, batch_id, template_id, result_path, original_name) VALUES (?, ?, ?, ?, ?)",
        [req.user.id, batchId, templateId, outputFileName,
          namePart + "_已填写_" + fillData.real_name + "_" + fillData.student_id + ".docx"]
      );
      fillResultId = fr.insertId;
    } catch (e) { fillResultId = Date.now(); }
    res.json(Res.success({
      fillId: fillResultId,
      fileName: tpl.name.replace(/.docx$/i, "") + "_已填写_" + fillData.real_name + "_" + fillData.student_id + ".docx",
    }, "填表完成，请下载文件"));
  } catch (e) {
    console.error("[填表] 失败:", e.message);
    res.json(Res.error("填表失败：" + e.message));
  }
};

exports.downloadFill = async (req, res) => {
  try {
    const { id } = req.params;
    let resultPath = null;
    let downloadName = "综测登记表_已填写.docx";
    try {
      const [rows] = await pool.execute(
        "SELECT * FROM fill_results WHERE id = ? AND user_id = ?",
        [id, req.user.id]
      );
      if (rows.length > 0) {
        resultPath = rows[0].result_path;
        downloadName = rows[0].original_name || downloadName;
      }
    } catch (e) { /* 表可能不存在 */ }
    if (!resultPath) {
      const dir = path.join(__dirname, "../../../uploads");
      const files = fs.readdirSync(dir).filter(function(f) { return f.startsWith("filled_"); }).sort();
      if (files.length === 0) return res.json(Res.error("未找到填表结果"));
      resultPath = files[files.length - 1];
    }
    const filePath = path.join(__dirname, "../../../uploads", resultPath);
    if (!fs.existsSync(filePath)) return res.json(Res.error("填表文件丢失"));
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.setHeader("Content-Disposition", "attachment; filename*=UTF-8''" + encodeURIComponent(downloadName));
    res.setHeader("Content-Length", fs.statSync(filePath).size);
    fs.createReadStream(filePath).pipe(res);
  } catch (e) {
    console.error("[下载] 失败:", e.message);
    res.json(Res.error("下载失败：" + e.message));
  }
};

// ★ 获取当前用户的填表预览数据（替代原来的 mock-data）
exports.getFillPreview = async (req, res) => {
  try {
    const { batch_id } = req.query;
    const preview = await getFillDataPreview(req.user.id, batch_id);
    res.json(Res.success(preview));
  } catch (e) {
    console.error("[预览] 失败:", e.message);
    res.json(Res.error(e.message));
  }
};

// ★ 保存智能填表数据（分数 + 描述）
exports.saveFillData = async (req, res) => {
  try {
    const { items } = req.body;
    if (!items || !Array.isArray(items)) return res.json(Res.error("缺少 items 数组"));

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      for (const item of items) {
        if (!item.section || !item.item_key) continue;
        await conn.execute(
          `INSERT INTO smart_fill_data (user_id, rule_set_id, section, item_key, score, description, extra_data)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE score=VALUES(score), description=VALUES(description), extra_data=VALUES(extra_data)`,
          [req.user.id, item.rule_set_id || 0, item.section, item.item_key,
           item.score ?? 0, item.description || '', item.extra_data ? JSON.stringify(item.extra_data) : null]
        );
      }
      await conn.commit();
      res.json(Res.success(null, "已保存"));
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally { conn.release(); }
  } catch (e) {
    console.error("[保存填表数据] 失败:", e.message);
    res.json(Res.error(e.message));
  }
};

// ★ AI 生成 F1 描述
exports.generateF1Descriptions = async (req, res) => {
  try {
    const { section, item_key, item_name } = req.body;
    const { chatStream } = require("../../services/zongce/ai/aiService");

    const prompt = `你是高校辅导员，需要为综测表中"${item_name || item_key}"这一项写一段简短评语（20-40字）。
要求：积极正面、合理可信、解释该学生为什么能获得此项的评分。直接输出评语，不要引号。`;

    let desc = "";
    const stream = await chatStream(
      [{ role: "user", content: prompt }],
      { temperature: 0.7, maxTokens: 200 }
    );
    for await (const token of stream) desc += token;
    desc = desc.trim().replace(/^["'""']|["'""']$/g, '');

    res.json(Res.success({ description: desc || `${item_name || item_key}表现良好，符合评分标准。` }));
  } catch (e) {
    console.error("[生成F1描述] 失败:", e.message);
    // 失败时返回兜底描述
    res.json(Res.success({ description: `${req.body.item_name || req.body.item_key}表现良好，符合评分标准。` }));
  }
};

// ★ 获取智能填表数据（供前端加载）
exports.getSmartFillData = async (req, res) => {
  try {
    const { rule_set_id } = req.query;
    if (!rule_set_id) return res.json(Res.error("缺少 rule_set_id"));

    const [rows] = await pool.execute(
      "SELECT * FROM smart_fill_data WHERE user_id = ? AND rule_set_id = ?",
      [req.user.id, rule_set_id]
    );
    res.json(Res.success(rows));
  } catch (e) {
    console.error("[获取填表数据] 失败:", e.message);
    res.json(Res.error(e.message));
  }
};
