const { chatStreamJson } = require("./aiService");
const { FACT_EXTRACT_SYSTEM, VERSION } = require("./promptTemplates");
const { validateFactExtraction } = require("./schemas");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ============================================================
//  从多个附件提取事实（★ 合并分析，不取最高置信度）
// ============================================================
async function extractFacts(attachments) {
  const allFacts = [];
  let totalClarity = 0;
  const allMissing = new Set();

  for (const att of attachments) {
    const filePath = path.join(__dirname, "../../../../uploads", att.file_path);
    const ext = path.extname(att.file_name).toLowerCase();

    let result;
    if ([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"].includes(ext)) {
      result = await extractFromImage(filePath, ext, att.file_name);
    } else {
      result = await extractFromDocument(filePath, ext);
    }

    const valid = validateFactExtraction(result);
    if (!valid.ok) {
      console.warn(`[FactExtract] 附件 ${att.file_name} 校验失败: ${valid.error}`);
      continue;
    }

    // ★ 合并事实，去重
    for (const fact of result.facts) {
      if (!allFacts.some((f) => f.value === fact.value && f.type === fact.type)) {
        allFacts.push({
          ...fact,
          fact_id: fact.fact_id || `f${allFacts.length + 1}`,
          source_file: att.file_name,
          attachment_id: att.id,
        });
      }
    }

    totalClarity += result.overall_clarity || 0;
    if (result.missing_info) {
      result.missing_info.forEach((m) => allMissing.add(m));
    }
  }

  // ★ 重新分配 fact_id，确保唯一且有序
  allFacts.forEach((f, i) => { f.fact_id = `f${i + 1}`; });

  // ★ 生成输入哈希（文件内容摘要）
  const inputHash = crypto.createHash("sha256")
    .update(allFacts.map((f) => f.source_text || "").join("|"))
    .digest("hex").slice(0, 16);

  return {
    facts: allFacts,
    overall_clarity: attachments.length > 0 ? totalClarity / attachments.length : 0,
    missing_info: [...allMissing],
    model: "deepseek-chat",
    prompt_version: VERSION,
    input_hash: inputHash,
  };
}

async function extractFromImage(filePath, ext, fileName) {
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString("base64");
  const mimeMap = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp" };
  const mime = mimeMap[ext] || "image/png";

  // Step 1: OCR 提取文字（非流式）
  const { ocrImage } = require("./aiService");
  const text = await ocrImage(base64);
  if (!text.trim()) return { facts: [], overall_clarity: 0, missing_info: ["图片中未识别到文字"] };

  // Step 2: 从 OCR 文字中提取事实（流式）
  return await chatStreamJson(
    [
      { role: "system", content: FACT_EXTRACT_SYSTEM },
      { role: "user", content: `请从以下OCR识别结果中提取客观事实：\n\n${text}` },
    ],
    { temperature: 0.1, maxTokens: 2048 }
  );
}

async function extractFromDocument(filePath, ext) {
  let text = "";
  if (ext === ".docx") {
    const mammoth = require("mammoth");
    text = (await mammoth.extractRawText({ path: filePath })).value;
  } else if (ext === ".pdf") {
    const pdfParse = require("pdf-parse");
    text = (await pdfParse(fs.readFileSync(filePath))).text;
  } else {
    text = fs.readFileSync(filePath, "utf-8");
  }

  if (!text.trim()) {
    return { facts: [], overall_clarity: 0, missing_info: ["文件内容为空"] };
  }

  const messages = [
    { role: "system", content: FACT_EXTRACT_SYSTEM },
    { role: "user", content: `请提取以下文档中的客观事实：\n\n${text}` },
  ];

  return await chatStreamJson(messages, { temperature: 0.1, maxTokens: 2048 });
}

module.exports = { extractFacts };
