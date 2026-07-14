const { chatStreamJson } = require("./deepseek");
const { FACT_EXTRACT_SYSTEM, VERSION } = require("./prompts");
const { validateFactExtraction } = require("./schemas");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { isOssUrl, downloadBuffer } = require("../../../services/oss");

// ★ 统一获取附件 Buffer（OSS 下载 / 本地磁盘读取）
async function getAttachmentBuffer(att) {
  if (isOssUrl(att.file_path)) {
    return await downloadBuffer(att.file_path);
  }
  // 向后兼容：裸文件名从本地磁盘读取
  const filePath = path.join(__dirname, "../../../../uploads", att.file_path);
  return fs.readFileSync(filePath);
}

// ============================================================
//  从多个附件提取事实（★ 合并分析，不取最高置信度）
// ============================================================
async function extractFacts(attachments) {
  const allFacts = [];
  let totalClarity = 0;
  const allMissing = new Set();

  for (const att of attachments) {
    const buffer = await getAttachmentBuffer(att);
    const ext = path.extname(att.file_name).toLowerCase();

    let result;
    if ([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"].includes(ext)) {
      result = await extractFromImage(buffer, ext, att.file_name);
    } else {
      result = await extractFromDocument(buffer, ext);
    }

    const valid = validateFactExtraction(result);
    if (!valid.ok) {
      console.warn(`[FactExtract] 附件 ${att.file_name} 校验失败: ${valid.error}`);
      continue;
    }

    // ★ 合并事实，去重，并修正 type=other
    for (const fact of result.facts) {
      if (!allFacts.some((f) => f.value === fact.value && f.type === fact.type)) {
        // 如果 AI 返回 type=other，根据内容语义推断正确类型
        let correctedType = fact.type;
        if (fact.type === 'other') {
          correctedType = inferFactType(fact);
          console.log(`[FactExtract] 修正 type: other → ${correctedType} (${fact.value})`);
        }
        allFacts.push({
          ...fact,
          type: correctedType,
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

async function extractFromImage(buffer, ext, fileName) {
  const base64 = buffer.toString("base64");
  const mimeMap = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp" };
  const mime = mimeMap[ext] || "image/png";

  // Step 1: OCR 提取文字（用 Kimi vision 模型）
  const { ocrWithKimi } = require("./deepseek");
  const text = await ocrWithKimi(base64, mime);
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

async function extractFromDocument(buffer, ext) {
  let text = "";
  if (ext === ".docx") {
    const mammoth = require("mammoth");
    text = (await mammoth.extractRawText({ buffer })).value;
  } else if (ext === ".pdf") {
    const pdfParse = require("pdf-parse");
    text = (await pdfParse(buffer)).text;
  } else {
    text = buffer.toString("utf-8");
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

// ============================================================
//  结构化事实提取（材料分析新版：含规则分类建议）
// ============================================================
const { MATERIAL_EXTRACT_SYSTEM } = require("./prompts");

async function extractStructuredFacts(attachments) {
  const allFacts = [];
  let totalClarity = 0;
  let needsReview = false;
  let reviewReason = null;

  for (const att of attachments) {
    const buffer = await getAttachmentBuffer(att);
    const ext = path.extname(att.file_name).toLowerCase();

    let result;
    if ([".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"].includes(ext)) {
      // 图片 → Kimi OCR → 结构化提取
      const base64 = buffer.toString("base64");
      const mimeMap = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif", ".webp": "image/webp", ".bmp": "image/bmp" };
      const mime = mimeMap[ext] || "image/png";

      const { ocrWithKimi } = require("./deepseek");
      const ocrText = await ocrWithKimi(base64, mime);
      if (!ocrText.trim()) {
        console.warn(`[FactExtract] ${att.file_name} OCR 无结果`);
        continue;
      }
      result = await chatStreamJson(
        [{ role: "system", content: MATERIAL_EXTRACT_SYSTEM }, { role: "user", content: `请从以下OCR文本中提取结构化事实：\n\n${ocrText}` }],
        { temperature: 0.1, maxTokens: 2048 }
      );
    } else if (ext === ".docx") {
      const mammoth = require("mammoth");
      const text = (await mammoth.extractRawText({ buffer })).value;
      if (!text.trim()) continue;
      result = await chatStreamJson(
        [{ role: "system", content: MATERIAL_EXTRACT_SYSTEM }, { role: "user", content: `请从以下文档中提取结构化事实：\n\n${text}` }],
        { temperature: 0.1, maxTokens: 2048 }
      );
    } else {
      const text = buffer.toString("utf-8");
      if (!text.trim()) continue;
      result = await chatStreamJson(
        [{ role: "system", content: MATERIAL_EXTRACT_SYSTEM }, { role: "user", content: `请从以下文本中提取结构化事实：\n\n${text}` }],
        { temperature: 0.1, maxTokens: 2048 }
      );
    }

    if (!result || !result.facts) {
      console.log('[FactExtract] AI response missing facts. Keys:', result ? Object.keys(result).join(',') : 'null');
      console.log('[FactExtract] Raw result sample:', JSON.stringify(result || {}).slice(0, 300));
      continue;
    }

    for (const f of result.facts) {
      f.fact_id = `f${allFacts.length + 1}`;
      f.attachment_id = att.id;
      f.source_file = att.file_name;
      allFacts.push(f);
    }
    totalClarity += result.overall_clarity || 0;
    if (result.needs_review) { needsReview = true; reviewReason = result.review_reason; }
  }

  return {
    facts: allFacts,
    overall_clarity: attachments.length > 0 ? totalClarity / attachments.length : 0,
    needs_review: needsReview,
    review_reason: reviewReason,
    model: "kimi",
    prompt_version: "v2.2",
  };
}

// ★ 当 AI 返回 type=other 时，根据内容关键词推断正确类型
function inferFactType(fact) {
  const text = (fact.value || '') + ' ' + (fact.detail?.organizer || '') + ' ' + (fact.source_text || '');
  const t = text.toLowerCase();

  // 关键词 → 类型映射（按优先级）
  const rules = [
    ['竞赛', '比赛', '建模', '挑战杯', '创新创业', '英语口语', '演讲比赛', '辩论赛', '程序设计', '电子设计', '机械创新'],
    ['干部', '学生会', '班长', '团支书', '委员', '部长', '社长', '负责人', '主席', '书记', '干事'],
    ['志愿', '实践', '社会调查', '支教', '三下乡', '义工', '公益', '献血', '环保', '服务队', '社区'],
    ['证书', '资格证', '等级考试', '四级', '六级', '计算机', '普通话', '教师资格', '会计', '驾照', ' CET'],
    ['成绩', '绩点', 'GPA', '学分', '均分', '排名'],
  ];
  const types = ['award', 'position', 'activity', 'certificate', 'score'];

  for (let i = 0; i < rules.length; i++) {
    if (rules[i].some(kw => text.includes(kw))) {
      return types[i];
    }
  }

  // 默认：有 rank/level/award 字段大概率是获奖
  const d = fact.detail || {};
  if (d.rank || d.level || d.award_rank || d.award_name) return 'award';

  return 'award'; // 最终兜底为 award
}

module.exports = { extractFacts, extractStructuredFacts, inferFactType };
