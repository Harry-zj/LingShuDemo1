const config = require("../../../config");

const DEEPSEEK = config.deepseek;

// ============================================================
//  通用对话
// ============================================================
async function chat(messages, options = {}) {
  const { temperature = 0.3, maxTokens = 4096, expectJson = false } = options;

  const body = {
    model: DEEPSEEK.model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };
  if (expectJson) {
    body.response_format = { type: "json_object" };
  }

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch(DEEPSEEK.baseUrl + "/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${DEEPSEEK.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120000),
      });

      if (!res.ok) {
        const text = await res.text();
        if (res.status >= 400 && res.status < 500) {
          throw new Error(`DeepSeek API ${res.status}: ${text}`);
        }
        throw new Error(`DeepSeek ${res.status}: ${text}`);
      }

      const data = await res.json();
      const content = data.choices[0].message.content;

      if (expectJson) {
        const cleaned = content.replace(/^```json\s*/, "").replace(/\s*```$/, "").trim();
        return JSON.parse(cleaned);
      }
      return content;
    } catch (err) {
      lastError = err;
      if (attempt < 3) {
        await sleep(Math.pow(2, attempt) * 1000);
      }
    }
  }
  throw lastError;
}

// ============================================================
//  图片分析
// ============================================================
async function analyzeImage(base64Image, prompt, mimeType = "image/png") {
  const messages = [
    {
      role: "user",
      content: [
        { type: "text", text: prompt },
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64Image}` } },
      ],
    },
  ];
  return chat(messages, { expectJson: true });
}

// ============================================================
//  文本 → 结构化数据
// ============================================================
async function extractStructuredData(text, systemPrompt) {
  const messages = [
    { role: "system", content: systemPrompt },
    { role: "user", content: text },
  ];
  return chat(messages, { expectJson: true });
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

module.exports = { chat, analyzeImage, extractStructuredData };
