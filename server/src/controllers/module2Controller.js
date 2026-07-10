const { pool } = require("../config/database"); const Res = require("../utils/response");
const { generateReport: aiGenerate } = require("../services/aiService");

// 维度配置（与前端 scoreHelper.js 保持一致）
const DIM_CONFIG = [
  { key: "de",  name: "德", desc: "思想政治 · 道德品质 · 纪律观念" },
  { key: "zhi", name: "智", desc: "课程成绩 · 学术竞赛 · 科技学术" },
  { key: "ti",  name: "体", desc: "身心健康 · 文体竞赛" },
  { key: "mei", name: "美", desc: "宣传报道" },
  { key: "lao", name: "劳", desc: "社会实践 · 劳动教育 · 社会工作" },
];

// 五维映射（与前端保持一致）
function calcDimensions(data) {
  const { aScores = {}, bScores = {}, scores = {} } = data;
  const de  = clamp(((aScores.A1||0)*0.4 + (aScores.A2||0)*0.3 + (aScores.A4||0)*0.3) / 20 * 100);
  const zhi = clamp(((scores.F2||0)*0.4 + (bScores.B1||0)*0.2 + (bScores.B2||0)*0.2 + (bScores.B3||0)*0.2) / 58 * 100);
  const ti  = clamp(((aScores.A5||0)*0.4 + (bScores.B7||0)*0.6) / 26 * 100);
  const mei = clamp((bScores.B4||0) / 30 * 100);
  const lao = clamp(((bScores.B6||0)*0.5 + (bScores.B8||0)*0.3 + (bScores.B5||0)*0.2) / 30 * 100);
  return { de, zhi, ti, mei, lao };
}
function calcF(scores = {}) { return parseFloat(((scores.F1||0)*0.1 + (scores.F2||0)*0.65 + (scores.F3||0)*0.25).toFixed(2)); }
function getLevel(s) { if (s >= 90) return "优秀"; if (s >= 80) return "良好"; if (s >= 70) return "中等"; if (s >= 60) return "合格"; return "待提升"; }
function clamp(v, min=0, max=100) { const n = Number(v); return isNaN(n) ? 0 : Math.max(min, Math.min(max, Math.round(n))); }

// 多学年 mock 数据
const MOCK_BY_YEAR = {
  "大一": {
    student: { name: "张三", grade: "2023级", major: "计算机科学与技术", class: "计科2301班", semester: "2023-2024学年" },
    scores: { F1: 80, F2: 72, F3: 75 },
    aScores: { A1: 16, A2: 14, A3: 15, A4: 13, A5: 12 },
    bScores: { B1: 18, B2: 14, B3: 16, B4: 12, B5: 16, B6: 20, B7: 14, B8: 18 },
    classAvg: { F1: 78, F2: 70, F3: 72, A1: 15, A2: 13, A3: 14, A4: 12, A5: 11, B1: 17, B2: 13, B3: 15, B4: 10, B5: 15, B6: 18, B7: 12, B8: 16 },
    rank: 18, totalStudents: 38, majorRank: 52, majorTotal: 118
  },
  "大二": {
    student: { name: "张三", grade: "2023级", major: "计算机科学与技术", class: "计科2301班", semester: "2024-2025学年" },
    scores: { F1: 82, F2: 75, F3: 78 },
    aScores: { A1: 17, A2: 15, A3: 16, A4: 14, A5: 13 },
    bScores: { B1: 20, B2: 16, B3: 18, B4: 14, B5: 18, B6: 22, B7: 15, B8: 20 },
    classAvg: { F1: 79, F2: 71, F3: 74, A1: 16, A2: 13, A3: 15, A4: 12, A5: 12, B1: 19, B2: 14, B3: 16, B4: 11, B5: 16, B6: 19, B7: 13, B8: 17 },
    rank: 12, totalStudents: 38, majorRank: 35, majorTotal: 118
  },
  "大三": {
    student: { name: "张三", grade: "2023级", major: "计算机科学与技术", class: "计科2301班", semester: "2025-2026学年" },
    scores: { F1: 85, F2: 80, F3: 84 },
    aScores: { A1: 18, A2: 16, A3: 17, A4: 15, A5: 14 },
    bScores: { B1: 22, B2: 18, B3: 20, B4: 15, B5: 20, B6: 24, B7: 16, B8: 22 },
    classAvg: { F1: 80, F2: 72, F3: 75, A1: 16, A2: 14, A3: 15, A4: 13, A5: 12, B1: 20, B2: 16, B3: 18, B4: 12, B5: 18, B6: 20, B7: 14, B8: 18 },
    rank: 5, totalStudents: 38, majorRank: 8, majorTotal: 118
  }
};

// 批次标题 → 学年映射
const BATCH_YEAR_MAP = {
  "2023-2024学年": "大一",
  "2024-2025学年": "大二",
  "2025-2026学年": "大三"
};

// 获取评定结果（默认大三，选批次后按批次标题匹配学年）
exports.getEvaluation = async (req, res) => {
  try {
    let year = "大三"; // 默认
    const { batch_id } = req.query;
    if (batch_id) {
      const [batches] = await pool.execute("SELECT title FROM batches WHERE id = ?", [batch_id]);
      if (batches.length) {
        year = BATCH_YEAR_MAP[batches[0].title] || "大三";
      }
    }
    const data = JSON.parse(JSON.stringify(MOCK_BY_YEAR[year] || MOCK_BY_YEAR["大三"]));
    data.scores.F = calcF(data.scores);
    res.json(Res.success({ ...data, year }));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 生成评定报告（优先 AI，失败时模板兜底）
exports.generateReport = async (req, res) => {
  try {
    // 根据 batch_id 确定学年
    let year = "大三";
    if (req.body.batch_id) {
      const [batches] = await pool.execute("SELECT title FROM batches WHERE id = ?", [req.body.batch_id]);
      if (batches.length) year = BATCH_YEAR_MAP[batches[0].title] || "大三";
    }
    const data = JSON.parse(JSON.stringify(MOCK_BY_YEAR[year] || MOCK_BY_YEAR["大三"]));
    data.scores.F = calcF(data.scores);
    const dims = calcDimensions(data);
    const totalScore = data.scores.F;
    const dimDetail = DIM_CONFIG.map(d => ({ ...d, score: dims[d.key], levelLabel: getLevel(dims[d.key]) }));
    const subScores = { F1: data.scores.F1, F2: data.scores.F2, F3: data.scores.F3 };

    // 尝试 AI 生成
    const aiResult = await aiGenerate({
      student: data.student, totalScore, dimensions: dimDetail, subScores,
      rank: data.rank, totalStudents: data.totalStudents
    });

    if (aiResult) {
      // AI 成功
      res.json(Res.success({
        report_content: aiResult.report,
        advice: aiResult.advice,
        dimensions: dims,
        total_score: totalScore,
        source: "ai"
      }, "AI 评语生成成功"));
      return;
    }

    // AI 失败 — 模板兜底
    const sorted = DIM_CONFIG.map(d => ({ ...d, score: dims[d.key] })).sort((a, b) => b.score - a.score);
    const best = sorted[0], second = sorted[1], worst = sorted[4], secondWorst = sorted[3];
    const reportLines = [
      `综测总分：${totalScore} 分  |  班级排名：第 ${data.rank} / ${data.totalStudents} 名`,
      `计算公式：F = F1×10% + F2×65% + F3×25% = ${data.scores.F1}×10% + ${data.scores.F2}×65% + ${data.scores.F3}×25%`,
      "",
      "【五维得分明细】",
      ...sorted.map(d => `  ${d.name}（${d.desc}）：${d.score} 分  [${getLevel(d.score)}]`),
      "",
      `【优势分析】你在「${best.name}」维度表现最为突出（${best.score}分），${best.desc}方面展现了扎实的基础与优秀能力。`,
      second ? `「${second.name}」维度同样表现不俗（${second.score}分），可作为第二核心竞争力继续巩固。` : "",
      "",
      `【提升方向】「${worst.name}」维度有较大提升空间（${worst.score}分），${worst.desc}方面建议下阶段重点突破。`,
      secondWorst && secondWorst.score < 70 ? `「${secondWorst.name}」维度（${secondWorst.score}分）也需要同步关注，建议制定专项改进计划。` : "",
      "",
      "【综合评价】",
      totalScore >= 90 ? "整体表现卓越，德智体美劳全面发展，望再接再厉，追求更高成就。" :
      totalScore >= 80 ? "整体表现优秀，各维度发展较为均衡，继续保持并争取突破。" :
      totalScore >= 70 ? "整体表现良好，部分维度已达中上水平，建议重点补齐短板以实现全面进步。" :
      totalScore >= 60 ? "整体表现合格，但多个维度存在明显短板，建议制定系统的提升计划。" :
      "整体表现需重点提升，建议在保持基本素质的同时，加强课程学习与创新实践能力培养。"
    ];
    const reportContent = reportLines.filter(Boolean).join("\n");

    // 生成建议
    const advice = [];
    if (sorted[0]) advice.push({ type: "strength", title: `持续巩固「${sorted[0].name}」优势`, content: `在${sorted[0].desc}方面表现优异（${sorted[0].score}分），建议在此基础上继续深入，争取成为核心优势领域。` });
    if (sorted[1] && sorted[1].score >= 80) advice.push({ type: "strength", title: `发挥「${sorted[1].name}」带动作用`, content: `${sorted[1].desc}维度得分${sorted[1].score}分，可作为第二增长点，带动综测总分进一步提升。` });
    if (sorted[4]) advice.push({ type: "weakness", title: `重点提升「${sorted[4].name}」维度`, content: `${sorted[4].desc}方面目前得分${sorted[4].score}分（${getLevel(sorted[4].score)}），建议分析薄弱原因，积极参与相关活动，补齐短板。` });
    if (sorted[3] && sorted[3].score < 75) advice.push({ type: "weakness", title: `同步关注「${sorted[3].name}」维度`, content: `${sorted[3].desc}维度得分${sorted[3].score}分，仍有提升空间，可作为下阶段努力方向。` });

    res.json(Res.success({ report_content: reportContent, advice, dimensions: dims, total_score: totalScore, source: "template" }, "报告生成成功（模板）"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 班级统计
exports.getClassStats = async (req, res) => {
  try {
    const data = JSON.parse(JSON.stringify(MOCK_BY_YEAR["大三"]));
    res.json(Res.success({
      avg_score: 75.3,
      class_size: data.totalStudents,
      my_rank: data.rank,
      rankings: [],
      dimension_averages: { de: 78, zhi: 72, ti: 65, mei: 58, lao: 70 },
    }));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 历史发展数据（从 MOCK_BY_YEAR 统一计算，确保五维分数与学年数据一致）
exports.getHistory = async (req, res) => {
  try {
    const years = ["大一", "大二", "大三"];
    const semesters = years.map(year => {
      const data = MOCK_BY_YEAR[year];
      data.scores.F = calcF(data.scores);
      const dims = calcDimensions(data);
      const totalScore = data.scores.F;
      return {
        semester: data.student.semester,
        year,
        scores: { ...dims, total: totalScore },
        ranking: { majorRank: data.majorRank, majorTotal: data.majorTotal, classRank: data.rank, classTotal: data.totalStudents },
        rating: getLevel(totalScore),
        milestones: []
      };
    });
    // 大三的里程碑
    semesters[2].milestones = ["完成暑期社会实践项目", "获校级三等奖学金"];
    semesters[1].milestones = ["担任班级学习委员", "获院级优秀学生干部"];
    semesters[0].milestones = ["参加编程竞赛获校级三等奖", "加入学生会宣传部"];

    res.json(Res.success({ semesters, currentSemester: "2025-2026学年" }));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 发展建议
exports.getAdvice = async (req, res) => {
  try {
    const data = JSON.parse(JSON.stringify(MOCK_BY_YEAR["大三"]));
    const dims = calcDimensions(data);
    const sorted = DIM_CONFIG.map(d => ({ ...d, score: dims[d.key] })).sort((a, b) => b.score - a.score);
    const advice = [];
    if (sorted[0]) advice.push({ type: "strength", title: `继续保持「${sorted[0].name}」优势`, content: `在${sorted[0].desc}领域表现突出（${sorted[0].score}分），展现了扎实的能力基础，建议在此方向上继续深耕。` });
    if (sorted[4]) advice.push({ type: "weakness", title: `重点提升「${sorted[4].name}」维度`, content: `${sorted[4].desc}得分相对较低（${sorted[4].score}分），建议多参与相关实践活动，拓展该领域经历，争取全面提升。` });
    if (sorted[3] && sorted[3].score < 75) advice.push({ type: "weakness", title: `同步加强「${sorted[3].name}」`, content: `${sorted[3].desc}维度（${sorted[3].score}分）同样存在提升空间，可结合日常学习生活逐步改善。` });
    res.json(Res.success(advice));
  } catch (e) { res.json(Res.error(e.message)); }
};
