const { chat } = require("./aiService");
const { RULE_PARSE_SYSTEM } = require("./promptTemplates");

// ============================================================
//  大文档拆分并行解析
//  输入：完整文本 + 用户约束
//  输出：合并后的 { rule_items: [...] }
// ============================================================
async function parseInChunks(fullText, constraintText = "", onProgress) {
  const chunks = splitByParagraphs(fullText, 2000);
  console.log(`[RuleParser] 文档 ${fullText.length} 字符，拆分为 ${chunks.length} 段并行解析`);

  let completed = 0;
  const total = chunks.length;
  const report = () => {
    if (onProgress) onProgress({ completed, total, phase: 'parsing' });
  };
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

// ============================================================
//  按段落拆分，尽量保持每段不超过 maxChars
// ============================================================
function splitByParagraphs(text, maxChars) {
  // 按空行或标题行分割
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

// ============================================================
//  解析单个分段
// ============================================================
async function parseOneChunk(chunkText, constraintText, index, total) {
  const prefix = total > 1 ? `（第 ${index}/${total} 段）` : "";
  const userContent = constraintText
    ? `=== 用户补充约束 ===\n${constraintText}\n\n=== 规则文档${prefix} ===\n${chunkText}`
    : `=== 规则文档${prefix} ===\n${chunkText}`;

  try {
    return await chat(
      [
        { role: "system", content: RULE_PARSE_SYSTEM },
        { role: "user", content: userContent },
      ],
      { temperature: 0.1, expectJson: true, maxTokens: 8192 }
    );
  } catch (e) {
    console.warn(`[RuleParser] 分段 ${index}/${total} 解析失败: ${e.message}`);
    return { rule_items: [] };
  }
}

module.exports = { parseInChunks };
