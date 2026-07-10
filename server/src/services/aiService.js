/**
 * DeepSeek AI 评语生成服务
 */
const DEEPSEEK_API = "https://api.deepseek.com/chat/completions";

/**
 * 生成综合评语和发展建议
 * @param {Object} data - { student, totalScore, dimensions, subScores }
 * @returns {{ report: string, advice: Array }}
 */
async function generateReport(data) {
  const { student, totalScore, dimensions, subScores } = data;

  const prompt = `你是高校综测"德智体美劳"五维评定系统的评语生成助手。请根据以下学生数据生成评定报告。

## 学生信息
- 姓名：${student.name}
- 年级：${student.grade}，专业：${student.major}，班级：${student.class}

## 综测成绩
- 总分：${totalScore} 分（满分100）
- 计算公式：F = F1×10% + F2×65% + F3×25%
- 基本素质 F1：${subScores.F1}分 | 课程成绩 F2：${subScores.F2}分 | 创新实践 F3：${subScores.F3}分
- 班级排名：第 ${data.rank || "?"} / ${data.totalStudents || "?"} 名

## 五维得分（百分制）
${dimensions.map(d => `- ${d.name}（${d.desc}）：${d.score} 分 [${d.levelLabel}]`).join("\n")}

## 要求
请用 JSON 格式返回，不要包含其他文字：
{
  "report": "综合评语（150-250字，包含对五维的分析和总体评价，语气鼓励但客观，不要和下面advice内容重复）",
  "advice": [
    { "type": "strength", "title": "优势建议标题（8-15字）", "content": "具体的保持建议（30-60字）" },
    { "type": "weakness", "title": "提升建议标题（8-15字）", "content": "具体的提升建议（30-60字）" }
  ]
}

advice 数组包含 3-4 条建议，至少1条优势 + 2条提升，要求具体可操作。`;

  try {
    const res = await fetch(DEEPSEEK_API, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: process.env.DEEPSEEK_MODEL || "deepseek-chat",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        max_tokens: 1200,
      }),
    });

    if (!res.ok) throw new Error(`DeepSeek API ${res.status}`);

    const json = await res.json();
    const text = json.choices?.[0]?.message?.content || "";

    // 解析 JSON（DeepSeek 有时会在 JSON 外面包裹 markdown 代码块）
    const clean = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    const result = JSON.parse(clean);
    return { report: result.report, advice: result.advice || [] };
  } catch (e) {
    console.error("[AI] DeepSeek 调用失败:", e.message);
    return null;  // 返回 null 让调用方用模板兜底
  }
}

module.exports = { generateReport };
