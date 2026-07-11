/**
 * 对话式填表引擎
 * - 扫描 Word 模板占位符
 * - AI 分类字段（简单数据 vs 需要叙事文案）
 * - SSE 流式对话生成文案
 * - 模板填充
 */

const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const { chatStream, chatStreamJson } = require("./ai/aiService");

function scanFields(templatePath) {
  const content = fs.readFileSync(templatePath);
  const zip = new PizZip(content);
  let xml = "";
  try { xml = zip.files["word/document.xml"].asText(); } catch (e) { return []; }
  const matches = xml.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g) || [];
  return [...new Set(matches)]
    .filter(p => !p.startsWith("{#") && !p.startsWith("{/"))
    .map(p => p.slice(1, -1));
}

async function classifyFields(fields) {
  const messages = [
    { role: "system", content: `字段分类助手。将模板占位符分为两类：
1. simple: 简单数据字段（姓名、学号、日期、分数、编号等，直接填入固定值即可）
2. narrative: 需要叙述性文案的字段（个人总结、项目经历、规划、自评、说明等，需要AI生成大段文字）
返回纯JSON: {"fields":[{"key":"字段名","type":"simple|narrative","label":"中文说明"}]}` },
    { role: "user", content: `请分类这些占位符: ${JSON.stringify(fields)}` },
  ];

  try {
    const result = await chatStreamJson(messages, { temperature: 0.1, maxTokens: 1024 });
    if (result && result.fields) return result.fields;
  } catch (e) { console.warn("[ChatFill] 分类降级:", e.message); }

  // 降级：关键词分类
  const narrativeKeywords = ["总结", "经历", "规划", "计划", "说明", "自评", "描述", "介绍", "report", "summary", "experience", "plan"];
  return fields.map(f => {
    const isNarrative = narrativeKeywords.some(kw => f.toLowerCase().includes(kw));
    return { key: f, type: isNarrative ? "narrative" : "simple", label: f };
  });
}

async function* chatAboutField(fieldInfo, messages, simpleFields = {}) {
  const contextIntro = Object.keys(simpleFields).length > 0
    ? `已知基本信息：${JSON.stringify(simpleFields)}\n\n`
    : "";

  const systemPrompt = `你是表格填写助手。用户正在填写表格中的「${fieldInfo.label || fieldInfo.key}」字段。
根据用户的描述，生成专业、连贯的第一人称叙述文案。
${fieldInfo.wordLimit ? `字数控制在${fieldInfo.wordLimit}字以内。` : ""}
要求：语言正式但不刻板、逻辑清晰、分段合理。`;

  const fullMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];

  const stream = await chatStream(fullMessages, { temperature: 0.7, maxTokens: 2048 });
  yield* stream;
}

function fillTemplate(templatePath, fieldContents) {
  const content = fs.readFileSync(templatePath);
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });
  doc.render(fieldContents);
  return doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" });
}

module.exports = { scanFields, classifyFields, chatAboutField, fillTemplate };
