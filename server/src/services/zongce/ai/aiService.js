const config = require("../../../config");
const DEEPSEEK = config.deepseek;

// ============================================================
//  流式对话（统一使用，不超时，边生成边接收）
// ============================================================
async function chatStream(messages, options = {}) {
  const { temperature = 0.3, maxTokens = 4096 } = options;

  const body = {
    model: DEEPSEEK.model,
    messages,
    temperature,
    max_tokens: maxTokens,
    stream: true,
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

  return {
    async *[Symbol.asyncIterator]() {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

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
  return JSON.parse(cleaned);
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

module.exports = { chatStream, chatStreamJson, analyzeImage, ocrImage };
