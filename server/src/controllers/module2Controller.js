const { pool } = require("../config/database");
const Res = require("../utils/response");
const { generateReport: aiGenerate } = require("../services/aiService");

const DIM_CONFIG = [
  { key: "de",  name: "德", desc: "思想政治 · 道德品质 · 纪律观念" },
  { key: "zhi", name: "智", desc: "课程成绩 · 学术竞赛 · 科技学术" },
  { key: "ti",  name: "体", desc: "身心健康 · 文体竞赛" },
  { key: "mei", name: "美", desc: "宣传报道" },
  { key: "lao", name: "劳", desc: "社会实践 · 劳动教育 · 社会工作" },
];

function clamp(v, min = 0, max = 100) {
  const n = Number(v);
  return isNaN(n) ? 0 : Math.max(min, Math.min(max, Math.round(n)));
}

function calcDimensions(data) {
  const { aScores = {}, bScores = {}, scores = {} } = data;
  const de  = clamp(((aScores.A1 || 0) * 0.4 + (aScores.A2 || 0) * 0.3 + (aScores.A4 || 0) * 0.3) / 20 * 100);
  const zhi = clamp(((scores.F2 || 0) * 0.4 + (bScores.B1 || 0) * 0.2 + (bScores.B2 || 0) * 0.2 + (bScores.B3 || 0) * 0.2) / 58 * 100);
  const ti  = clamp(((aScores.A5 || 0) * 0.4 + (bScores.B7 || 0) * 0.6) / 26 * 100);
  const mei = clamp((bScores.B4 || 0) / 30 * 100);
  const lao = clamp(((bScores.B6 || 0) * 0.5 + (bScores.B8 || 0) * 0.3 + (bScores.B5 || 0) * 0.2) / 30 * 100);
  return { de, zhi, ti, mei, lao };
}

function calcF(scores = {}) {
  return parseFloat(((scores.F1 || 0) * 0.1 + (scores.F2 || 0) * 0.65 + (scores.F3 || 0) * 0.25).toFixed(2));
}

async function getGradeLevels() {
  const [rows] = await pool.execute(
    "SELECT config_value FROM evaluation_config WHERE config_key = 'grade_levels'"
  );
  if (rows.length > 0 && rows[0].config_value) {
    const val = rows[0].config_value;
    return typeof val === "string" ? JSON.parse(val) : val;
  }
  return [
    { min: 90, label: "优秀", color: "#059669", bg: "#ECFDF5" },
    { min: 80, label: "良好", color: "#4F46E5", bg: "#EEF2FF" },
    { min: 70, label: "中等", color: "#D97706", bg: "#FFFBEB" },
    { min: 60, label: "合格", color: "#DC2626", bg: "#FEF2F2" },
    { min: 0,  label: "待提升", color: "#9CA3AF", bg: "#F3F4F6" },
  ];
}

function getLevel(score, levels) {
  const sorted = [...levels].sort((a, b) => b.min - a.min);
  return sorted.find(l => score >= l.min) || levels[levels.length - 1];
}

function extractScoreData(dimensionScores) {
  if (!dimensionScores)
    return { aScores: {}, bScores: {}, scores: {}, classAvg: {}, rank: null, totalStudents: null, majorRank: null, majorTotal: null };
  const ds = typeof dimensionScores === "string" ? JSON.parse(dimensionScores) : dimensionScores;
  return {
    aScores: ds.aScores || {},
    bScores: ds.bScores || {},
    scores: ds.scores || {},
    classAvg: ds.classAvg || {},
    rank: ds.rank || null,
    totalStudents: ds.totalStudents || null,
    majorRank: ds.majorRank || null,
    majorTotal: ds.majorTotal || null,
  };
}

async function getStudentInfo(userId) {
  const [users] = await pool.execute(
    "SELECT id, real_name AS name, grade, major, class_name AS class FROM users WHERE id = ?", [userId]
  );
  if (users.length === 0)
    return { name: "未知用户", grade: "", major: "", class: "" };
  const u = users[0];
  return { name: u.name || "未知用户", grade: u.grade || "", major: u.major || "", class: u.class || "" };
}

async function getBatchTitle(batchId) {
  if (!batchId) return null;
  const [rows] = await pool.execute("SELECT title FROM assessment_batches WHERE id = ?", [batchId]);
  return rows.length > 0 ? rows[0].title : null;
}

exports.getEvaluation = async (req, res) => {
  try {
    const { batch_id } = req.query;
    const batchId = batch_id || 101;
    const [rows] = await pool.execute(
      "SELECT * FROM evaluation_results WHERE user_id = ? AND batch_id = ?", [req.user.id, batchId]
    );
    if (rows.length === 0) return res.json(Res.success(null, "暂无评定数据"));
    const record = rows[0];
    const { aScores, bScores, scores, classAvg, rank, totalStudents, majorRank, majorTotal } =
      extractScoreData(record.dimension_scores);
    const student = await getStudentInfo(req.user.id);
    const semester = await getBatchTitle(batchId);
    const gradeLevels = await getGradeLevels();
    const dims = calcDimensions({ aScores, bScores, scores });
    const totalScore = record.total_score || calcF(scores);
    const dimensionScores = DIM_CONFIG.map(d => ({
      ...d, score: dims[d.key], level: getLevel(dims[d.key], gradeLevels),
    }));
    res.json(Res.success({
      student: { ...student, semester: semester || "2025-2026学年" },
      scores: { F: totalScore, F1: scores.F1, F2: scores.F2, F3: scores.F3 },
      aScores, bScores, classAvg, rank,
      totalStudents: totalStudents || 38, majorRank, majorTotal: majorTotal || 118,
      totalScore, gradeLevel: getLevel(totalScore, gradeLevels), dimensionScores,
    }));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.generateReport = async (req, res) => {
  try {
    const { batch_id } = req.body || {};
    const batchId = batch_id || 101;
    const [rows] = await pool.execute(
      "SELECT * FROM evaluation_results WHERE user_id = ? AND batch_id = ?", [req.user.id, batchId]
    );
    if (rows.length === 0) return res.json(Res.error("暂无评定数据"));
    const record = rows[0];
    const { aScores, bScores, scores, rank, totalStudents } = extractScoreData(record.dimension_scores);
    const student = await getStudentInfo(req.user.id);
    const gradeLevels = await getGradeLevels();
    const dims = calcDimensions({ aScores, bScores, scores });
    const totalScore = record.total_score || calcF(scores);
    const aiData = {
      student, totalScore, rank, totalStudents, subScores: scores,
      dimensions: DIM_CONFIG.map(d => ({
        ...d, score: dims[d.key], levelLabel: getLevel(dims[d.key], gradeLevels).label
      })),
    };
    try {
      const aiResult = await aiGenerate(aiData);
      if (aiResult) return res.json(Res.success({
        report_content: aiResult.report, advice: aiResult.advice,
        dimensions: aiData.dimensions, total_score: totalScore, source: "ai",
      }, "报告生成成功（AI）"));
    } catch (aiErr) { console.log("[module2] AI 生成失败，使用模板兜底:", aiErr.message); }
    const sorted = DIM_CONFIG.map(d => ({ ...d, score: dims[d.key] })).sort((a, b) => b.score - a.score);
    const reportLines = [
      `${student.name}同学：`,
      `你的综测总分为 ${totalScore} 分，等级为「${getLevel(totalScore, gradeLevels).label}」。`,
      ...sorted.map(d => `${d.name}（${d.desc}）：${d.score} 分 —— ${getLevel(d.score, gradeLevels).label}`),
      totalScore >= 90 ? "整体表现优秀，各维度发展较为均衡，继续保持并争取突破。"
        : totalScore >= 80 ? "整体表现较为优秀，展现较好的综合素质，建议在保持优势的基础上补齐短板。"
        : totalScore >= 70 ? "整体表现良好，部分维度已达中上水平，建议重点补齐短板以实现全面进步。"
        : totalScore >= 60 ? "整体表现合格，但多个维度存在明显短板，建议制定系统的提升计划。"
        : "整体表现需重点提升，建议在保持基本素质的同时，加强课程学习与创新实践能力培养。",
    ];
    const advice = [];
    if (sorted[0]) advice.push({ type: "strength", title: `持续巩固「${sorted[0].name}」优势`,
      content: `在${sorted[0].desc}方面表现优异（${sorted[0].score}分），建议在此基础上继续深入，争取成为核心优势领域。` });
    if (sorted[1] && sorted[1].score >= 80) advice.push({ type: "strength", title: `发挥「${sorted[1].name}」带动作用`,
      content: `${sorted[1].desc}维度得分${sorted[1].score}分，可作为第二增长点，带动综测总分进一步提升。` });
    if (sorted[4]) advice.push({ type: "weakness", title: `重点提升「${sorted[4].name}」维度`,
      content: `${sorted[4].desc}方面目前得分${sorted[4].score}分（${getLevel(sorted[4].score, gradeLevels).label}），建议分析薄弱原因，积极参与相关活动，补齐短板。` });
    if (sorted[3] && sorted[3].score < 75) advice.push({ type: "weakness", title: `同步关注「${sorted[3].name}」维度`,
      content: `${sorted[3].desc}维度得分${sorted[3].score}分，仍有提升空间，可作为下阶段努力方向。` });
    res.json(Res.success({
      report_content: reportLines.filter(Boolean).join("\n"), advice,
      dimensions: aiData.dimensions, total_score: totalScore, source: "template",
    }, "报告生成成功（模板）"));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.getClassStats = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM evaluation_results WHERE user_id = ? AND batch_id = 101", [req.user.id]
    );
    if (rows.length === 0) return res.json(Res.success(null, "暂无班级数据"));
    const record = rows[0];
    const { rank, totalStudents, classAvg } = extractScoreData(record.dimension_scores);
    const classDims = classAvg && Object.keys(classAvg).length > 0
      ? calcDimensions({ aScores: classAvg, bScores: classAvg, scores: classAvg })
      : null;
    res.json(Res.success({
      avg_score: 75.3, class_size: totalStudents || 38, my_rank: rank, rankings: [],
      dimension_averages: classDims
        ? { de: classDims.de, zhi: classDims.zhi, ti: classDims.ti, mei: classDims.mei, lao: classDims.lao }
        : { de: 78, zhi: 72, ti: 65, mei: 58, lao: 70 },
    }));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.getHistory = async (req, res) => {
  try {
    const [records] = await pool.execute(
      "SELECT er.*, ab.title AS batch_title FROM evaluation_results er LEFT JOIN assessment_batches ab ON er.batch_id = ab.id WHERE er.user_id = ? ORDER BY er.batch_id", [req.user.id]
    );
    const gradeLevels = await getGradeLevels();
    const semesters = records.map(r => {
      const { aScores, bScores, scores, majorRank, majorTotal, rank, totalStudents } =
        extractScoreData(r.dimension_scores);
      const dims = calcDimensions({ aScores, bScores, scores });
      const totalScore = r.total_score || calcF(scores);
      return {
        semester: r.batch_title || "未知学期", year: r.batch_title || "",
        scores: { ...dims, total: totalScore },
        ranking: {
          majorRank: majorRank || rank, majorTotal: majorTotal || totalStudents || 38,
          classRank: rank, classTotal: totalStudents || 38,
        },
        rating: getLevel(totalScore, gradeLevels).label, milestones: [],
      };
    });
    res.json(Res.success({
      semesters,
      currentSemester: semesters.length > 0 ? semesters[semesters.length - 1].semester : "",
    }));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.getAdvice = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM evaluation_results WHERE user_id = ? AND batch_id = 101", [req.user.id]
    );
    if (rows.length === 0) return res.json(Res.success([]));
    const { aScores, bScores, scores } = extractScoreData(rows[0].dimension_scores);
    const dims = calcDimensions({ aScores, bScores, scores });
    const gradeLevels = await getGradeLevels();
    const sorted = DIM_CONFIG.map(d => ({ ...d, score: dims[d.key] })).sort((a, b) => b.score - a.score);
    const advice = [];
    if (sorted[0]) advice.push({ type: "strength", title: `继续保持「${sorted[0].name}」优势`,
      content: `在${sorted[0].desc}领域表现突出（${sorted[0].score}分），展现了扎实的能力基础，建议在此方向上继续深耕。` });
    if (sorted[4]) advice.push({ type: "weakness", title: `重点提升「${sorted[4].name}」维度`,
      content: `${sorted[4].desc}得分相对较低（${sorted[4].score}分），建议多参与相关实践活动，拓展该领域经历，争取全面提升。` });
    if (sorted[3] && sorted[3].score < 75) advice.push({ type: "weakness", title: `同步加强「${sorted[3].name}」`,
      content: `${sorted[3].desc}维度（${sorted[3].score}分）同样存在提升空间，可结合日常学习生活逐步改善。` });
    res.json(Res.success(advice));
  } catch (e) { res.json(Res.error(e.message)); }
};