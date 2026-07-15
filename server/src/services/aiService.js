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
  const { student, totalScore, dimensions, subScores, formItems } = data;

  const itemsText = formItems?.length
    ? `\n## 该生实际加分事件清单\n${formItems.map(it => `- [${it.section}·${it.key}] ${it.title}：${it.reason}（得分：${it.score}分）`).join("\n")}`
    : '';

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
${itemsText}

## 要求
请用 JSON 格式返回，不要包含其他文字：
{
  "report": "综合评语（300-500字，分段落撰写：第一段总览全局概述该生整体表现和综测分数；第二段逐一分析德智体美劳五个维度各自的得分情况、亮点和不足；第三段给出总结性评价和鼓励。语气亲切鼓励但不失客观专业，使用'该生'或'同学'称谓）",
  "advice": [
    { "type": "strength", "title": "优势建议标题（10-20字）", "content": "具体的保持建议（40-80字）" },
    { "type": "strength", "title": "优势建议标题（10-20字）", "content": "具体的保持建议（40-80字）" },
    { "type": "weakness", "title": "提升建议标题（10-20字）", "content": "具体的提升建议（40-80字）" },
    { "type": "weakness", "title": "提升建议标题（10-20字）", "content": "具体的提升建议（40-80字）" }
  ],
  "shortPlan": ["本月/期末前可执行的具体行动项1（15-30字，针对薄弱维度）", "行动项2", "行动项3"],
  "longPlan": ["学年内可执行的具体行动项1（15-30字，针对薄弱维度）", "行动项2", "行动项3"],
  "highlights": [
    { "title": "亮点标题（5-10字）", "detail": "亮点说明（15-25字，引用加分事件清单中的具体事件）" },
    { "title": "亮点标题", "detail": "亮点说明" }
  ],
  "gaps": [
    { "title": "待提升事项（5-10字）", "detail": "具体说明（15-25字，指出得分较低或缺失的活动类型）" },
    { "title": "待提升事项", "detail": "具体说明" }
  ]
}

advice 4条（2优+2弱），shortPlan和longPlan各3条，highlights 2-3条基于真实加分事件，gaps 2-3条指出得分较低或缺失的活动类型。`;

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
    return {
      report: result.report,
      advice: result.advice || [],
      shortPlan: result.shortPlan || [],
      longPlan: result.longPlan || [],
      highlights: result.highlights || [],
      gaps: result.gaps || [],
    };
  } catch (e) {
    console.error("[AI] DeepSeek 调用失败:", e.message);
    return null;  // 返回 null 让调用方用模板兜底
  }
}

/**
 * 生成单个维度的AI个性画像分析
 */
async function generateDimensionProfile(student, dimData, allScores) {
  const prompt = `你是高校综测"德智体美劳"五维评定系统的个性画像生成助手。请为以下学生的"${dimData.name}"维度生成个性化分析。

## 学生信息
- 姓名：${student.name}，年级：${student.grade}，专业：${student.major}

## ${dimData.name}维度数据
- 得分：${dimData.score} 分（百分制），等级：${dimData.levelLabel}
- 维度说明：${dimData.desc}
${dimData.items ? `- 分项明细：\n${dimData.items.map(i => `  · ${i.label}：${i.rawScore}/${i.maxScore}（权重${i.weight}）`).join('\n')}` : ''}

## 全维度参考
${allScores.map(d => `- ${d.name}：${d.score}分 [${d.levelLabel}]`).join('\n')}

## 要求
请用 JSON 格式返回，不要包含其他文字：
{
  "summary": "该维度个性化分析（40-60字，精炼简洁）：用一句话概括该生在此维度的表现水平，点出最突出的1-2个具体优势或不足，语气亲切鼓励，使用'你'称谓"
}`;

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
        max_tokens: 500,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content || "";
    const clean = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    return JSON.parse(clean);
  } catch (e) {
    console.error("[AI] 维度画像生成失败:", e.message);
    return null;
  }
}

/**
 * 生成历史趋势智能总结
 */
async function generateTrendSummary(data) {
  const { semesters } = data;
  const historyText = semesters.map((s, i) => {
    const prev = i > 0 ? semesters[i-1] : null;
    const totalDiff = prev ? (s.scores.total - prev.scores.total).toFixed(1) : '首次';
    const rankDiff = prev && prev.ranking?.majorRank ? (prev.ranking.majorRank - s.ranking.majorRank) : 0;
    const rankInfo = s.ranking?.majorRank ? `，专业排名第${s.ranking.majorRank}名` : '';
    return `${s.year}：总分${s.scores.total}分(${s.rating})${rankInfo}${prev ? `，较上学年${totalDiff > 0 ? '+' : ''}${totalDiff}分` : ''}`;
  }).join('\n');

  const prompt = `你是高校综测趋势分析助手。根据以下学生历年数据生成3-4张总结卡片：

## 历史数据
${historyText}

## 五维变化
${semesters.length >= 2 ? DIM_CONFIG_KEYS.map(k => {
  const first = semesters[0].scores[k] || 0;
  const last = semesters[semesters.length-1].scores[k] || 0;
  const DIM_NAMES = { de:'德育', zhi:'智育', ti:'体育', mei:'美育', lao:'劳育' };
  return `${DIM_NAMES[k] || k}：${first}分→${last}分（${change >= 0 ? '+' : ''}${change}分）`;
}).join('\n') : ''}

## 要求
用JSON返回，每张卡片含icon(emoji)、title(5-10字)、text(40-80字，2-3句话，先描述现状再给建议)：
{"cards":[{"icon":"📊","title":"整体趋势","text":"总分变化与趋势判断"},{"icon":"🏆","title":"最快进步","text":"进步最大维度及具体分值"},{"icon":"🎯","title":"重点关注","text":"下滑维度及具体分值"},{"icon":"💡","title":"成长建议","text":"2-3条具体可操作建议"}]}`;

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
        max_tokens: 1000,
      }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const text = json.choices?.[0]?.message?.content || "";
    const clean = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
    return JSON.parse(clean);
  } catch (e) {
    console.error("[AI] 趋势总结生成失败:", e.message);
    return null;
  }
}

const DIM_CONFIG_KEYS = ['de','zhi','ti','mei','lao'];

module.exports = { generateReport, generateDimensionProfile, generateTrendSummary };
