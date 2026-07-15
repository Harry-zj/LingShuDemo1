/**
 * 对话式填表引擎 V2
 * - AI 解析 Word 表格结构，识别标签-值对（不再依赖 {占位符}）
 * - AI 分类字段（简单数据 vs 需要叙事文案）
 * - SSE 流式对话生成文案（带用户上下文）
 * - OSS 存储支持（Buffer 输入输出）
 */

const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const { chatStream, chatStreamJson } = require("./ai/aiService");

/**
 * 从 Word 文档 XML 提取纯文本（去除标签，合并空白）
 */
function extractPlainText(xml) {
  return xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * AI 驱动的表单字段检测
 * 分析 Word 文档结构，识别所有需要填写的字段
 * @param {Buffer} templateBuffer - .docx 文件的 Buffer
 * @returns {Promise<Array<{key, label, type, hint}>>}
 */
async function detectFormFields(templateBuffer) {
  const zip = new PizZip(templateBuffer);
  let xml = "";
  try { xml = zip.files["word/document.xml"].asText(); } catch (e) { return []; }

  const plainText = extractPlainText(xml);

  // 先尝试 regex 匹配 {placeholder}（兼容旧模板）
  const placeholderMatches = xml.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g) || [];
  const placeholders = [...new Set(placeholderMatches)]
    .filter(p => !p.startsWith("{#") && !p.startsWith("{/"))
    .map(p => p.slice(1, -1));

  if (placeholders.length > 0) {
    // 旧模板：有占位符，只需分类
    const messages = [
      { role: "system", content: `字段分类助手。将模板占位符分为三类：
1. simple: 简单数据（姓名、学号、日期、电话、分数、编号等，直接填入固定值）
2. narrative: 需要叙述性文案（个人总结、项目经历、规划、自评、获奖情况等，需要AI生成大段文字）
3. image: 照片、图片位

返回纯JSON: {"fields":[{"key":"字段名","type":"simple|narrative|image","label":"中文标签","hint":"填写提示"}]}` },
      { role: "user", content: `请分类这些占位符: ${JSON.stringify(placeholders)}` },
    ];
    try {
      const result = await chatStreamJson(messages, { temperature: 0.1, maxTokens: 1024 });
      if (result && result.fields) return result.fields;
    } catch (e) { console.warn("[ChatFill] AI分类降级:", e.message); }
    return fallbackClassify(placeholders);
  }

  // 新版：无占位符，AI 从文档文本中识别表单字段
  const messages = [
    { role: "system", content: `你是表单分析专家。分析Word报名表，识别所有需要填写的空白字段。
规则：
- key: 英文字段名（如 name, gender, phone, awards）
- label: 原始中文标签
- type: "simple"（姓名/日期/电话等可直接填入）| "narrative"（获奖情况/个人总结等需AI生成文案）| "image"（照片/图片）
- hint: 简洁的填写提示

返回纯JSON: {"fields":[{"key":"name","label":"姓名","type":"simple","hint":"请输入姓名"}]}

注意：像"主要获奖情况"这种需要大段文字叙述的字段，type应为"narrative"。
只识别需要填写的空白字段，标题、说明文字不算。` },
    { role: "user", content: `请分析以下报名表的字段：\n\n${plainText.substring(0, 3000)}` },
  ];

  try {
    const result = await chatStreamJson(messages, { temperature: 0.1, maxTokens: 2048 });
    if (result && result.fields) return result.fields;
  } catch (e) {
    console.error("[ChatFill] AI字段识别失败:", e.message);
  }

  return [];
}

/**
 * 降级关键词分类
 */
function fallbackClassify(fields) {
  const narrativeKeywords = ["总结", "经历", "规划", "计划", "说明", "自评", "描述", "介绍", "获奖", "情况", "report", "summary", "experience", "plan"];
  return fields.map(f => {
    const isNarrative = narrativeKeywords.some(kw => f.toLowerCase().includes(kw));
    return { key: f, type: isNarrative ? "narrative" : "simple", label: f, hint: "" };
  });
}

/**
 * 流式对话 —— 针对某个 narrative 字段与用户对话生成文案
 * AI 会基于用户已填的 simple 字段值主动引导对话
 */
async function* chatAboutField(fieldInfo, messages, simpleFields = {}) {
  const simpleContext = Object.keys(simpleFields).length > 0
    ? `\n用户已填写的基本信息：${JSON.stringify(simpleFields)}`
    : "";

  const systemPrompt = `你是表格填写助手。用户正在填写报名表中的「${fieldInfo.label || fieldInfo.key}」字段。
${fieldInfo.hint ? `填写提示：${fieldInfo.hint}` : ""}${simpleContext}

请主动与用户对话，引导用户提供相关经历和素材。根据用户描述，生成专业、连贯的文案。
要求：语言正式但不刻板、逻辑清晰、内容具体有细节、使用第一人称。`;

  const fullMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  // 如果没有历史消息，AI 先主动发起对话
  if (messages.length === 0) {
    fullMessages.push({
      role: "user",
      content: `请主动引导我填写「${fieldInfo.label || fieldInfo.key}」字段。你可以先基于已知信息简单介绍我，然后问我相关问题，帮我生成这个字段的文案内容。`
    });
  }

  const stream = await chatStream(fullMessages, { temperature: 0.7, maxTokens: 2048 });
  yield* stream;
}

/**
 * 模板填充 —— 使用 docxtemplater 渲染
 * @param {Buffer} templateBuffer - .docx 模板 Buffer
 * @param {Object} fieldContents - { field_key: "value", ... }
 * @returns {Buffer} 生成的 .docx Buffer
 */
function fillTemplate(templateBuffer, fieldContents) {
  const zip = new PizZip(templateBuffer);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.render(fieldContents);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}

module.exports = { detectFormFields, chatAboutField, fillTemplate, extractPlainText };
