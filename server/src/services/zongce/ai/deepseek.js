const config = require("../../../config");
const DEEPSEEK = config.deepseek;
function apiUrl(baseUrl) { const clean = (baseUrl || '').replace(/\/+$/, ''); return clean + (clean.endsWith('/v1') ? '/chat/completions' : '/v1/chat/completions'); }

// ============================================================
//  流式对话（统一使用，不超时，边生成边接收）
// ============================================================
async function chatStream(messages, options = {}) {
  const { temperature = 0.3, maxTokens = 4096, timeoutMs = 300000, jsonMode = false, signal } = options;

  const body = {
    model: DEEPSEEK.model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  };

  // ★ DeepSeek 支持 response_format 约束 JSON 输出，减少 preamble/截断问题
  if (jsonMode) {
    body.response_format = { type: "json_object" };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(apiUrl(DEEPSEEK.baseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: signal || controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error(signal?.aborted ? 'CANCELLED' : `DeepSeek API 超时 (${timeoutMs / 1000}s)`);
    throw e;
  }

  if (!res.ok) {
    clearTimeout(timer);
    const text = await res.text();
    throw new Error(`DeepSeek API ${res.status}: ${text}`);
  }

  return {
    async *[Symbol.asyncIterator]() {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") return;
            try {
              const c = JSON.parse(data).choices?.[0]?.delta?.content;
              if (c) yield c;
            } catch (e) { /* skip malformed SSE chunks */ }
          }
        }
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

// ============================================================
//  JSON 清洗工具 —— 处理 AI 返回的格式问题
// ============================================================

/**
 * 从 AI 返回文本中提取并修复 JSON
 * AI 经常返回不规范的 JSON: 尾逗号、code block包裹、多JSON粘连、截断等
 */
function extractAndCleanJson(raw) {
  let text = raw.trim();

  // 1. 移除 markdown 代码块标记
  text = text.replace(/```(?:json)?\s*\n?/gi, '').replace(/```\s*$/gi, '');

  // 2. 尝试找到最外层的 { 或 [ (处理 AI 在 JSON 前后加了解释文字的情况)
  let jsonStart = -1, jsonEnd = -1;
  let braceDepth = 0, bracketDepth = 0;
  let inString = false, escapeNext = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (ch === '\\') { escapeNext = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (ch === '{') {
      if (jsonStart === -1) jsonStart = i;
      braceDepth++;
    } else if (ch === '}') {
      braceDepth--;
      if (braceDepth === 0 && bracketDepth === 0) { jsonEnd = i + 1; break; }
    } else if (ch === '[') {
      if (jsonStart === -1) jsonStart = i;
      bracketDepth++;
    } else if (ch === ']') {
      bracketDepth--;
      if (braceDepth === 0 && bracketDepth === 0) { jsonEnd = i + 1; break; }
    }
  }

  // ★ 如果未找到闭合边界（AI 输出被截断），使用全部文本
  if (jsonStart !== -1 && jsonEnd === -1) {
    jsonEnd = text.length;
  }

  if (jsonStart !== -1 && jsonEnd > jsonStart) {
    text = text.substring(jsonStart, jsonEnd);
  }

  // 3. 修复常见的 JSON 格式问题
  // 删除尾逗号（在 } 或 ] 之前的逗号）
  text = text.replace(/,(\s*[}\]])/g, '$1');

  // 4. 删除尾随的逗号（对象/数组末尾）
  text = text.replace(/,\s*$/gm, '');

  // 5. 修复 NaN/Infinity 值
  text = text.replace(/:\s*NaN\b/g, ': null');
  text = text.replace(/:\s*Infinity\b/g, ': null');
  text = text.replace(/:\s*-Infinity\b/g, ': null');

  // 6. 修复未加引号的 key（简单情况）
  // (跳过，避免过度修改)

  return text.trim();
}

/**
 * ★ 尝试自动补全被截断的 JSON（当 AI 输出因 maxTokens 不足被截断时）
 * 策略：找到最后一个未闭合的字符串/对象/数组，尝试安全闭合
 */
function repairTruncatedJson(text) {
  if (!text) return text;
  let repaired = text.trim();

  // 1. 如果文本不以 { 或 [ 开头，尝试找到第一个 { 或 [
  const firstBrace = repaired.search(/[{[]/);
  if (firstBrace > 0) {
    repaired = repaired.substring(firstBrace);
  }

  // 2. 移除尾部可能被截断的 key/value（最后一个不完整的属性）
  // 找到最后一个完整的 "," 或 "{" 或 "["，截断到那里
  const lastComma = repaired.lastIndexOf(',\n');
  const lastClosing = Math.max(
    repaired.lastIndexOf('}\n'),
    repaired.lastIndexOf(']\n')
  );

  // 3. 统计未闭合的括号
  let braceDepth = 0, bracketDepth = 0;
  let inString = false, escapeNext = false;
  for (let i = 0; i < repaired.length; i++) {
    const ch = repaired[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (ch === '\\') { escapeNext = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braceDepth++;
    else if (ch === '}') braceDepth--;
    else if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth--;
  }

  // 4. 如果在字符串中间被截断（unclosed string），截断到上一个完整值
  if (inString) {
    // 回溯找到最后一个闭合的引号前的逗号
    const truncPoint = repaired.lastIndexOf('",');
    if (truncPoint > 0) {
      repaired = repaired.substring(0, truncPoint + 1); // 保留到引号
    }
    // 重新统计
    braceDepth = 0; bracketDepth = 0; inString = false;
    for (let i = 0; i < repaired.length; i++) {
      const ch = repaired[i];
      if (escapeNext) { escapeNext = false; continue; }
      if (ch === '\\') { escapeNext = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === '{') braceDepth++;
      else if (ch === '}') braceDepth--;
      else if (ch === '[') bracketDepth++;
      else if (ch === ']') bracketDepth--;
    }
  }

  // 5. 补全缺失的闭合括号
  while (braceDepth > 0) { repaired += '}'; braceDepth--; }
  while (bracketDepth > 0) { repaired += ']'; bracketDepth--; }

  // 6. 再次清理尾逗号
  repaired = repaired.replace(/,(\s*[}\]])/g, '$1');
  repaired = repaired.replace(/,\s*$/gm, '');

  return repaired;
}

/**
 * ★ 激进截断修复：当 JSON 被截断时，回溯找到最后一个完整的键值对，补全结构
 * 策略：假设 matched_rule_id 和 confidence 是必须字段，如果缺失则使用默认值
 */
function aggressiveTruncationRepair(text) {
  if (!text || text.length < 5) return '{}';
  let t = text.trim();

  // 1. 去 code block
  t = t.replace(/```(?:json)?\s*\n?/gi, '').replace(/```\s*$/gi, '');

  // 2. 找到第一个 {
  const start = t.indexOf('{');
  if (start < 0) return '{}';
  t = t.substring(start);

  // 3. 移除尾部不完整的 key/value（截断在字符串中间）
  // 找到最后一个完整的 ", 或 "}  或 "]
  const lastGoodComma = t.lastIndexOf('",');
  const lastGoodBrace = t.lastIndexOf('"}');
  const lastGoodBracket = t.lastIndexOf('"]');
  const lastGoodNum = t.lastIndexOf(',\n'); // 数字值后面

  // 取最靠后的完整断点
  let cutPoint = Math.max(lastGoodComma, lastGoodBrace, lastGoodBracket);
  if (cutPoint <= 0) {
    // 没有找到完整键值对，尝试找第一个冒号后的值
    const firstColon = t.indexOf(':');
    if (firstColon < 0) return '{}';
  }

  if (cutPoint > 0) {
    // 保留到完整断点，然后补全
    if (t[cutPoint] === '"' && (t[cutPoint + 1] === ',' || t[cutPoint + 1] === '}')) {
      cutPoint = cutPoint + 1; // 保留引号
    }
    t = t.substring(0, cutPoint + 1);
  }

  // 4. 去除尾部逗号
  t = t.replace(/,\s*$/, '');

  // 5. 统计括号，补全未闭合的
  let braceDepth = 0, bracketDepth = 0;
  let inString = false, escapeNext = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (escapeNext) { escapeNext = false; continue; }
    if (ch === '\\') { escapeNext = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') braceDepth++;
    else if (ch === '}') braceDepth--;
    else if (ch === '[') bracketDepth++;
    else if (ch === ']') bracketDepth--;
  }

  // 6. 如果 matched_rule_id 不存在于截断文本中，添加默认值
  if (!t.includes('"matched_rule_id"')) {
    if (t.endsWith('{')) t += '\n  "matched_rule_id": null,';
    else t += ',\n  "matched_rule_id": null';
    braceDepth = Math.max(braceDepth, 1); // 确保至少有一层闭合
  }
  if (!t.includes('"confidence"')) {
    t += ',\n  "confidence": 0';
  }
  if (!t.includes('"reason"')) {
    t += ',\n  "reason": "AI响应被截断，自动补全"';
  }

  // 7. 补全闭合括号
  while (bracketDepth > 0) { t += ']'; bracketDepth--; }
  while (braceDepth > 0) { t += '}'; braceDepth--; }

  // 8. 最后的尾逗号清理
  t = t.replace(/,(\s*[}\]])/g, '$1');

  return t;
}

// ============================================================
//  流式对话 → 累积为完整 JSON（增强版）
// ============================================================
async function chatStreamJson(messages, options = {}) {
  // ★ 默认开启 jsonMode，确保 AI 输出合法 JSON（减少 preamble/截断）
  const opts = { jsonMode: true, ...options };
  const stream = await chatStream(messages, opts);
  let full = "";
  for await (const token of stream) full += token;

  // 多轮清洗尝试（按可靠性排序）
  const cleanAttempts = [
    // 策略0: 标准清洗
    { label: 'standard', fn: () => extractAndCleanJson(full) },
    // 策略1: 截断修复（补全未闭合的括号和字符串）
    { label: 'repair', fn: () => repairTruncatedJson(full) },
    // 策略2: 先清洗再修复
    { label: 'clean+repair', fn: () => repairTruncatedJson(extractAndCleanJson(full)) },
    // 策略3: 只去 code block
    { label: 'no_codeblock', fn: () => full.replace(/```(?:json)?\s*/gi, '').replace(/```\s*/gi, '').trim() },
    // 策略4: 原始文本
    { label: 'raw', fn: () => full.trim() },
    // 策略5: ★ 更激进的截断修复：逐字符回溯找最后一个有效键值对
    { label: 'aggressive_repair', fn: () => aggressiveTruncationRepair(full) },
  ];

  let lastError = null;
  for (const { label, fn } of cleanAttempts) {
    const cleaned = fn();
    if (!cleaned || cleaned.length < 3) continue;
    try {
      const result = JSON.parse(cleaned);
      if (label !== 'standard') {
        console.log(`[AI] JSON 通过策略 "${label}" 成功解析`);
      }
      return result;
    } catch (e) {
      lastError = e;
    }
  }

  // 所有尝试失败，输出详细诊断
  const diagnostic = full.slice(-800);
  console.error(`[AI] JSON解析失败。已尝试 ${cleanAttempts.length} 种清洗策略。`);
  console.error(`[AI] 原始文本尾800字:`, diagnostic);

  // 尝试输出更具体的错误位置
  try {
    JSON.parse(extractAndCleanJson(full));
  } catch (e) {
    console.error(`[AI] 最终错误: ${e.message}`);
  }

  // ★ 尝试给出截断修复版本用于调试
  try {
    const repaired = repairTruncatedJson(full);
    JSON.parse(repaired);
    console.warn(`[AI] ⚠ 截断修复后 JSON 可解析，但未使用（解析策略已穷尽）`);
    console.warn(`[AI] 修复后 JSON 长度: ${repaired.length}, 原文长度: ${full.length}`);
  } catch (_) {}

  throw new Error(`AI返回格式异常（已尝试${cleanAttempts.length}种修复）: ${full.slice(0, 200)}...`);
}

// ============================================================
//  图片分析（非流式——DeepSeek vision 不支持 stream）
// ============================================================
async function analyzeImage(base64Image, prompt, mimeType = "image/png") {
  const body = {
    model: DEEPSEEK.model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 2048,
    response_format: { type: "json_object" },
  };

  const res = await fetch(apiUrl(DEEPSEEK.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${DEEPSEEK.apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`DeepSeek API ${res.status}: ${text}`);
  }

  const data = await res.json();
  const content = data.choices[0].message.content;
  const cleaned = extractAndCleanJson(content);
  return JSON.parse(cleaned);
}

// ============================================================
//  图片 OCR（非流式，返回纯文本）
// ============================================================
async function ocrImage(base64Image) {
  const body = {
    model: DEEPSEEK.model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "请提取以下图片中的所有文字。只输出文字，不要任何解释。" },
          { type: "image_url", image_url: { url: `data:image/png;base64,${base64Image}` } },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  };
  const res = await fetch(apiUrl(DEEPSEEK.baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${DEEPSEEK.apiKey}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`OCR ${res.status}: ${await res.text()}`);
  return (await res.json()).choices[0].message.content.trim();
}

// ============================================================
//  Kimi Vision OCR（DeepSeek 不支持图片，用 Kimi K2.6 做 OCR）
// ============================================================
async function ocrWithKimi(base64Image, mimeType = "image/png") {
  const KIMI = require("../../../config").kimi;
  if (!KIMI.apiKey) throw new Error("未配置 KIMI_API_KEY，无法进行图片 OCR");

  const body = {
    model: KIMI.model,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "请提取以下图片中的所有文字。只输出文字，不要任何解释。" },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
        ],
      },
    ],
    temperature: 0.1,
    max_tokens: 4096,
  };

  const url = apiUrl(KIMI.baseUrl);
  console.log(`[KimiOCR] 请求: ${url} model=${KIMI.model}`);

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${KIMI.apiKey}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    console.error(`[KimiOCR] fetch 失败:`, e.message);
    throw new Error(`Kimi API 连接失败: ${e.message}`);
  }

  if (!res.ok) {
    const text = await res.text();
    console.error(`[KimiOCR] HTTP ${res.status}: ${text.slice(0, 500)}`);
    throw new Error(`Kimi OCR ${res.status}: ${text.slice(0, 300)}`);
  }

  const data = await res.json();
  console.log(`[KimiOCR] 成功: ${data.choices?.[0]?.message?.content?.length || 0} 字`);
  return data.choices[0].message.content.trim();
}

module.exports = { chatStream, chatStreamJson, analyzeImage, ocrImage, ocrWithKimi };