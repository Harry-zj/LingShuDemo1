const { chatStreamJson } = require("./aiService");
const { RULE_PARSE_SYSTEM } = require("./promptTemplates");

// ============================================================
//  大文档拆分并行解析（流式接收，不超时）
// ============================================================
async function parseInChunks(fullText, constraintText = "", onProgress) {
  const chunks = splitByParagraphs(fullText, 2000);
  console.log(`[RuleParser] 文档 ${fullText.length} 字符，拆分为 ${chunks.length} 段并行解析`);

  let completed = 0;
  const total = chunks.length;
  const report = () => { if (onProgress) onProgress({ completed, total, phase: 'parsing' }); };
  report();

  const chunkResults = await Promise.all(
    chunks.map(async (chunk, i) => {
      const result = await parseOneChunk(chunk, constraintText, i + 1, total);
      completed++;
      report();
      return result;
    })
  );

  const allItems = [];
  for (const r of chunkResults) {
    if (r && r.rule_items) allItems.push(...r.rule_items);
  }
  if (!allItems.length) throw new Error("所有分段均未解析出规则");
  return { rule_items: allItems };
}

function splitByParagraphs(text, maxChars) {
  const sections = text.split(/\n{2,}/).filter((s) => s.trim().length > 0);
  const chunks = [];
  let current = "";
  for (const sec of sections) {
    if (current.length + sec.length > maxChars && current.length > 0) {
      chunks.push(current.trim());
      current = sec;
    } else {
      current += (current ? "\n\n" : "") + sec;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks.length > 0 ? chunks : [text];
}

// ★ 流式接收，累积完整 JSON 再解析
async function parseOneChunk(chunkText, constraintText, index, total) {
  const prefix = total > 1 ? `（第 ${index}/${total} 段）` : "";
  const userContent = constraintText
    ? `=== 用户补充约束 ===\n${constraintText}\n\n=== 规则文档${prefix} ===\n${chunkText}`
    : `=== 规则文档${prefix} ===\n${chunkText}`;

  try {
    return await chatStreamJson(
      [
        { role: "system", content: RULE_PARSE_SYSTEM },
        { role: "user", content: userContent },
      ],
      { temperature: 0.1, maxTokens: 8192 }
    );
  } catch (e) {
    console.warn(`[RuleParser] 分段 ${index}/${total} 失败: ${e.message}`);
    return { rule_items: [] };
  }
}

module.exports = { parseInChunks };
