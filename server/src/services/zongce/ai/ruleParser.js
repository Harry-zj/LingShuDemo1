const { pool } = require("../../../config/database");
const { chat } = require("./aiService");
const { RULE_PARSE_SYSTEM, VERSION } = require("./promptTemplates");
const { validateRuleParse } = require("./schemas");
const fs = require("fs");
const path = require("path");

// ============================================================
//  解析规则来源 → rule_items（完整事务：DELETE+INSERT+UPDATE）
// ============================================================
async function parseRuleSource(sourceId) {
  const [sources] = await pool.execute("SELECT * FROM rule_sources WHERE id = ?", [sourceId]);
  if (!sources.length) throw new Error("规则来源不存在");
  const source = sources[0];

  let text = source.original_text || "";
  if (source.source_type === "file" && source.file_path) {
    const filePath = path.join(__dirname, "../../../../uploads", source.file_path);
    text = await extractText(filePath, source.file_name);
    if (!text) throw new Error("无法从文件中提取文本");
    await pool.execute("UPDATE rule_sources SET original_text = ? WHERE id = ?", [text, sourceId]);
  }
  if (!text.trim()) throw new Error("规则文本为空");

  const [constraints] = await pool.execute(
    "SELECT original_text FROM rule_sources WHERE user_id = ? AND source_type = 'text' AND id != ?",
    [source.user_id, sourceId]
  );
  const constraintText = constraints.map((s) => s.original_text).join("\n");

  const userContent = constraintText
    ? `=== 用户补充约束 ===\n${constraintText}\n\n=== 规则文档 ===\n${text}`
    : `=== 规则文档 ===\n${text}`;

  const rawResult = await chat(
    [
      { role: "system", content: RULE_PARSE_SYSTEM },
      { role: "user", content: userContent },
    ],
    { temperature: 0.1, expectJson: true, maxTokens: 4096 }
  );

  const valid = validateRuleParse(rawResult);
  if (!valid.ok) throw new Error("AI解析结果校验失败: " + valid.error);

  // ★ 完整事务：DELETE旧数据 + INSERT新数据 + UPDATE状态，任一步失败全部回滚
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    // 删除旧 rule_items
    await conn.execute("DELETE FROM rule_items WHERE source_id = ?", [sourceId]);

    // 逐条插入新 rule_items（含结构化字段）
    for (const item of rawResult.rule_items) {
      await conn.execute(
        `INSERT INTO rule_items
         (user_id, source_id, category, description, level, score, rule_type,
          limit_value, scope, strategy,
          max_times, conflict_group, proof_required, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_confirm')`,
        [
          source.user_id, sourceId,
          item.category || null,
          item.description || "",
          item.level || null,
          item.score != null ? item.score : null,
          item.rule_type || "scoring",
          item.limit_value != null ? item.limit_value : null,
          item.scope || null,
          item.strategy || null,
          item.max_times || 1,
          item.conflict_group || null,
          JSON.stringify(item.proof_required || []),
        ]
      );
    }

    // 更新 source 状态 + 附加解析元信息
    const meta = `\n\n--- AI解析记录 ---\n模型: deepseek-chat\nPrompt版本: ${VERSION}\n解析时间: ${new Date().toISOString()}\n原始响应: ${JSON.stringify(rawResult).slice(0, 5000)}`;
    await conn.execute(
      "UPDATE rule_sources SET status = 'parsed', original_text = CONCAT(COALESCE(original_text,''), ?) WHERE id = ?",
      [meta, sourceId]
    );

    await conn.commit();
    return { count: rawResult.rule_items.length, version: VERSION };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function extractText(filePath, fileName) {
  const ext = path.extname(fileName).toLowerCase();

  if ([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"].includes(ext)) {
    const buffer = fs.readFileSync(filePath);
    const base64 = buffer.toString("base64");
    let mime = "image/png";
    if (ext === ".jpg" || ext === ".jpeg") mime = "image/jpeg";
    else if (ext === ".gif") mime = "image/gif";

    const { chat } = require("./aiService");
    return await chat(
      [
        { role: "system", content: "请从图片中识别并提取所有文字。只输出识别的文字，不要添加任何解释。" },
        {
          role: "user",
          content: [
            { type: "text", text: "请提取以下图片中的所有文字：" },
            { type: "image_url", image_url: { url: `data:${mime};base64,${base64}` } },
          ],
        },
      ],
      { temperature: 0.1 }
    );
  }

  if (ext === ".docx") {
    const mammoth = require("mammoth");
    return (await mammoth.extractRawText({ path: filePath })).value;
  }
  if (ext === ".pdf") {
    const pdfParse = require("pdf-parse");
    return (await pdfParse(fs.readFileSync(filePath))).text;
  }
  if ([".xlsx", ".xls"].includes(ext)) {
    const XLSX = require("xlsx");
    const workbook = XLSX.readFile(filePath);
    let text = "";
    for (const name of workbook.SheetNames) {
      text += `[Sheet: ${name}]\n${XLSX.utils.sheet_to_csv(workbook.Sheets[name])}\n\n`;
    }
    return text;
  }
  return fs.readFileSync(filePath, "utf-8");
}

module.exports = { parseRuleSource };
