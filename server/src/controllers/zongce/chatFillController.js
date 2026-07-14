const fs = require("fs");
const path = require("path");
const { pool } = require("../../config/database");
const Res = require("../../utils/response");
const { scanFields, classifyFields, chatAboutField, fillTemplate } = require("../../services/zongce/chatFillService");

exports.uploadTemplate = async (req, res) => {
  try {
    if (!req.file) return res.json(Res.error("请选择文件"));
    const ext = path.extname(req.file.originalname).toLowerCase();
    if (ext !== ".docx") {
      fs.unlink(req.file.path, () => {});
      return res.json(Res.error("仅支持 .docx 格式"));
    }
    const buf = fs.readFileSync(req.file.path);
    if (buf[0] !== 0x50 || buf[1] !== 0x4b) {
      fs.unlink(req.file.path, () => {});
      return res.json(Res.error("文件格式无效"));
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

exports.analyzeTemplate = async (req, res) => {
  try {
    const { templateId } = req.params;
    const [rows] = await pool.execute("SELECT * FROM fill_templates WHERE id=? AND user_id=?", [templateId, req.user.id]);
    if (rows.length === 0) return res.json(Res.error("模板不存在"));
    const tplPath = path.join(__dirname, "../../../uploads", rows[0].file_path);
    if (!fs.existsSync(tplPath)) return res.json(Res.error("模板文件丢失"));

    const fields = scanFields(tplPath);
    const classified = await classifyFields(fields);

    const sessionId = "chat_" + Date.now();
    try {
      await pool.execute(
        "INSERT INTO chat_fill_sessions (id, user_id, template_id, fields_json, status) VALUES (?, ?, ?, ?, ?)",
        [sessionId, req.user.id, templateId, JSON.stringify(classified), "analyzed"]
      );
    } catch (e) { /* 表可能不存在 */ }

    res.json(Res.success({ sessionId, templateId, fields: classified }));
  } catch (e) {
    console.error("[对话填表-分析]", e);
    res.json(Res.error(e.message));
  }
};

exports.chatField = async (req, res) => {
  try {
    const { fieldKey, fieldLabel, messages, simpleFields } = req.body;

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    });

    const fieldInfo = { key: fieldKey, label: fieldLabel || fieldKey };
    const stream = chatAboutField(fieldInfo, messages, simpleFields || {});

    for await (const token of stream) {
      res.write(`data: ${JSON.stringify({ token })}\n\n`);
    }
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (e) {
    console.error("[对话填表-对话]", e);
    if (!res.headersSent) {
      res.json(Res.error(e.message));
    } else {
      res.write(`data: ${JSON.stringify({ error: e.message })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }
};

exports.doFill = async (req, res) => {
  try {
    const { templateId, fieldContents, batch_id } = req.body;
    const batchId = Number(batch_id || 0) || null;
    const [rows] = await pool.execute("SELECT * FROM fill_templates WHERE id=? AND user_id=?", [templateId, req.user.id]);
    if (rows.length === 0) return res.json(Res.error("模板不存在"));
    const tplPath = path.join(__dirname, "../../../uploads", rows[0].file_path);
    if (!fs.existsSync(tplPath)) return res.json(Res.error("模板文件丢失"));

    const outputBuffer = fillTemplate(tplPath, fieldContents);
    const outputFileName = "chat_filled_" + Date.now() + "_" + rows[0].file_path;
    const outputPath = path.join(__dirname, "../../../uploads", outputFileName);
    fs.writeFileSync(outputPath, outputBuffer);

    let fillResultId;
    try {
      const namePart = rows[0].name.replace(/.docx$/i, "");
      const [fr] = await pool.execute(
        "INSERT INTO fill_results (user_id, batch_id, template_id, result_path, original_name) VALUES (?, ?, ?, ?, ?)",
        [req.user.id, batchId, templateId, outputFileName, namePart + "_对话填写_" + (fieldContents.real_name || "结果") + ".docx"]
      );
      fillResultId = fr.insertId;
    } catch (e) { fillResultId = Date.now(); }

    res.json(Res.success({ fillId: fillResultId }, "对话填表完成"));
  } catch (e) {
    console.error("[对话填表-填充]", e);
    res.json(Res.error(e.message));
  }
};
