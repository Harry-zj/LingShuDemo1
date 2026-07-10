const fs = require("fs");
const path = require("path");
const { pool } = require("../../config/database");
const Res = require("../../utils/response");
const { fillDocx, getFillData, getMockData } = require("../../services/zongce/fillService");
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
    if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
      fs.unlink(req.file.path, () => {});
      return res.json(Res.error("文件格式无效，请上传真正的 .docx 文件"));
    }
    let r;
    try {
      [r] = await pool.execute(
        "INSERT INTO fill_templates (user_id, name, file_path, template_type) VALUES (?, ?, ?, ?)",
        [req.user.id, req.file.originalname, req.file.filename, "docx"]
      );
    } catch (e) {
      [r] = await pool.execute(
        "INSERT INTO fill_templates (user_id, name, file_path) VALUES (?, ?, ?)",
        [req.user.id, req.file.originalname, req.file.filename]
      );
    }
    res.json(Res.success({ id: r.insertId, name: req.file.originalname, size: req.file.size }, "模板上传成功"));
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
    const { templateId } = req.params;
    const [tplRows] = await pool.execute(
      "SELECT * FROM fill_templates WHERE id = ? AND user_id = ?",
      [templateId, req.user.id]
    );
    if (tplRows.length === 0) return res.json(Res.error("模板不存在"));
    const tpl = tplRows[0];
    const templatePath = path.join(__dirname, "../../../uploads", tpl.file_path);
    if (!fs.existsSync(templatePath)) return res.json(Res.error("模板文件丢失，请重新上传"));
    const fillData = getFillData(req.user.id);
    const templateBuffer = fs.readFileSync(templatePath);
    const outputBuffer = smartFill(templateBuffer, fillData);
    const outputFileName = "filled_" + Date.now() + "_" + tpl.file_path;
    const outputPath = path.join(__dirname, "../../../uploads", outputFileName);
    fs.writeFileSync(outputPath, outputBuffer);
    let fillResultId;
    try {
      const namePart = tpl.name.replace(/.docx$/i, "");
      const [fr] = await pool.execute(
        "INSERT INTO fill_results (user_id, template_id, result_path, original_name) VALUES (?, ?, ?, ?)",
        [req.user.id, templateId, outputFileName,
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

exports.getMockData = async (req, res) => {
  try { res.json(Res.success(getMockData())); }
  catch (e) { res.json(Res.error(e.message)); }
};
