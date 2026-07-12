const config = require("../../../config");
const DEEPSEEK = config.deepseek;

// ============================================================
//  流式对话（统一使用，不超时，边生成边接收）
// ============================================================
async function chatStream(messages, options = {}) {
  const { temperature = 0.3, maxTokens = 4096, timeoutMs = 300000 } = options;

  const body = {
    model: DEEPSEEK.model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let res;
  try {
    res = await fetch(DEEPSEEK.baseUrl + "/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error(`DeepSeek API 超时 (${timeoutMs / 1000}s)`);
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
            } catch (e) { /* skip */ }
          }
        }
      } finally {
        clearTimeout(timer);
      }
    },
  };
}

// ============================================================
//  流式对话 → 累积为完整 JSON
// ============================================================
async function chatStreamJson(messages, options = {}) {
  const stream = await chatStream(messages, options);
  let full = "";
  for await (const token of stream) full += token;
  const cleaned = full.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch (e) {
    console.error(`[AI] JSON解析失败，原始返回(尾500字):`, cleaned.slice(-500));
    throw new Error(`AI返回格式异常: ${cleaned.slice(0, 200)}...`);
  }
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

  const res = await fetch(DEEPSEEK.baseUrl + "/v1/chat/completions", {
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
  const cleaned = content.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
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
  const res = await fetch(DEEPSEEK.baseUrl + "/v1/chat/completions", {
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

  const url = KIMI.baseUrl + "/v1/chat/completions";
  console.log(`[KimiOCR] 请求: ${url} model=${KIMI.model} key=${KIMI.apiKey ? KIMI.apiKey.slice(0,10)+'...' : '(未配置)'}`);

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
    console.error(`[KimiOCR] fetch 失败: cause=${e.cause} code=${e.code} message=${e.message}`);
    throw new Error(`Kimi API 连接失败: ${e.message} (${e.cause || e.code || 'unknown'})`);
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
