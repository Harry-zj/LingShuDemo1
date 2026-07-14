const { pool } = require("../config/database");
const Res = require("../utils/response");
const { generateReport: aiGenerate, generateDimensionProfile: aiDimProfile, generateTrendSummary: aiTrendSummary } = require("../services/aiService");

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
  const de  = clamp(((aScores.A1 || 0) * 0.25 + (aScores.A2 || 0) * 0.25 + (aScores.A3 || 0) * 0.25 + (aScores.A4 || 0) * 0.25) / 20 * 100);
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
    "SELECT id, real_name AS name, grade, major, class_name AS class FROM users WHERE id = ?",
    [userId]
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
    let batchId = batch_id;
    // 未指定批次时，查该用户最新的评定结果
    if (!batchId) {
      const [latest] = await pool.execute(
        "SELECT batch_id FROM evaluation_results WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
        [req.user.id]
      );
      batchId = latest.length > 0 ? latest[0].batch_id : null;
    }
    if (!batchId) return res.json(Res.success(null, "暂无评定数据"));
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
      student: { ...student, semester: semester || "" },
      scores: { F: totalScore, F1: scores.F1, F2: scores.F2, F3: scores.F3 },
      aScores, bScores, classAvg, rank,
      totalStudents, majorRank, majorTotal,
      totalScore, gradeLevel: getLevel(totalScore, gradeLevels), dimensionScores,
    }));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.generateReport = async (req, res) => {
  try {
    const { batch_id } = req.body || {};
    let batchId = batch_id;
    if (!batchId) {
      const [latest] = await pool.execute(
        "SELECT batch_id FROM evaluation_results WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
        [req.user.id]
      );
      batchId = latest.length > 0 ? latest[0].batch_id : null;
    }
    if (!batchId) return res.json(Res.error("暂无评定数据"));
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

    // 查询该批次的表单加分项详情（真实事件）
    let formItems = [];
    try {
      const [forms] = await pool.execute("SELECT id FROM assessment_forms WHERE student_id = ? AND batch_id = ? ORDER BY id DESC LIMIT 1", [req.user.id, batchId]);
      if (forms.length > 0) {
        const [items] = await pool.execute("SELECT section, sub_key, title, reason, score FROM assessment_form_items WHERE form_id = ? ORDER BY sort_order", [forms[0].id]);
        formItems = items;
      }
    } catch (e) { /* 表可能不存在 */ }

    const aiData = {
      student, totalScore, rank, totalStudents, subScores: scores,
      dimensions: DIM_CONFIG.map(d => ({
        ...d, score: dims[d.key], levelLabel: getLevel(dims[d.key], gradeLevels).label
      })),
      formItems: formItems.map(it => ({ section: it.section, key: it.sub_key, title: it.title, reason: it.reason, score: it.score })),
    };
    try {
      const aiResult = await aiGenerate(aiData);
      if (aiResult) return res.json(Res.success({
        report_content: aiResult.report, advice: aiResult.advice,
        shortPlan: aiResult.shortPlan || [], longPlan: aiResult.longPlan || [], highlights: aiResult.highlights || [], gaps: aiResult.gaps || [],
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
    // 查用户最新评定结果的批次
    const [latest] = await pool.execute(
      "SELECT batch_id FROM evaluation_results WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
      [req.user.id]
    );
    const batchId = latest.length > 0 ? latest[0].batch_id : null;
    if (!batchId) return res.json(Res.success(null, "暂无班级数据"));
    const [rows] = await pool.execute(
      "SELECT * FROM evaluation_results WHERE user_id = ? AND batch_id = ?",
      [req.user.id, batchId]
    );
    if (rows.length === 0) return res.json(Res.success(null, "暂无班级数据"));
    const record = rows[0];
    const { rank, totalStudents, classAvg } = extractScoreData(record.dimension_scores);
    const classDims = classAvg && Object.keys(classAvg).length > 0
      ? calcDimensions({ aScores: classAvg, bScores: classAvg, scores: classAvg })
      : null;
    res.json(Res.success({
      avg_score: null, class_size: totalStudents, my_rank: rank, rankings: [],
      dimension_averages: classDims
        ? { de: classDims.de, zhi: classDims.zhi, ti: classDims.ti, mei: classDims.mei, lao: classDims.lao }
        : null,
    }));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.getHistory = async (req, res) => {
  try {
    const [records] = await pool.execute(
      "SELECT er.*, ab.title AS batch_title FROM evaluation_results er LEFT JOIN assessment_batches ab ON er.batch_id = ab.id WHERE er.user_id = ? ORDER BY er.batch_id",
      [req.user.id]
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
          majorRank: majorRank || rank, majorTotal: majorTotal || totalStudents,
          classRank: rank, classTotal: totalStudents,
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
    // 查用户最新评定结果的批次
    const [latest] = await pool.execute(
      "SELECT batch_id FROM evaluation_results WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1",
      [req.user.id]
    );
    const batchId = latest.length > 0 ? latest[0].batch_id : null;
    if (!batchId) return res.json(Res.success([]));
    const [rows] = await pool.execute(
      "SELECT * FROM evaluation_results WHERE user_id = ? AND batch_id = ?",
      [req.user.id, batchId]
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

// ===== 报告缓存（服务端存储，跨设备同步） =====
exports.getReportCache = async (req, res) => {
  try {
    const batchId = req.query.batch_id ? parseInt(req.query.batch_id) : null;
    if (!batchId) return res.json(Res.success({}));
    const [rows] = await pool.execute(
      "SELECT report_data, dim_profiles, goals, plan_done FROM report_cache WHERE user_id = ? AND batch_id = ?",
      [req.user.id, batchId]
    );
    if (rows.length > 0) {
      const r = rows[0];
      res.json(Res.success({
        reportData: typeof r.report_data === 'string' ? JSON.parse(r.report_data) : r.report_data,
        dimProfiles: typeof r.dim_profiles === 'string' ? JSON.parse(r.dim_profiles) : r.dim_profiles,
        goals: typeof r.goals === 'string' ? JSON.parse(r.goals) : r.goals,
        planDone: typeof r.plan_done === 'string' ? JSON.parse(r.plan_done) : r.plan_done,
      }));
    } else {
      res.json(Res.success({}));
    }
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.saveReportCache = async (req, res) => {
  try {
    const { batchId, reportData, dimProfiles, goals, planDone } = req.body || {};
    if (!batchId) return res.json(Res.error("缺少batchId"));
    await pool.execute(
      `INSERT INTO report_cache (user_id, batch_id, report_data, dim_profiles, goals, plan_done)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE report_data = VALUES(report_data), dim_profiles = VALUES(dim_profiles), goals = VALUES(goals), plan_done = VALUES(plan_done)`,
      [req.user.id, batchId, JSON.stringify(reportData || null), JSON.stringify(dimProfiles || null), JSON.stringify(goals || null), JSON.stringify(planDone || null)]
    );
    res.json(Res.success(null, "缓存已保存"));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.getDimensionProfiles = async (req, res) => {
  try {
    const { batch_id } = req.query;
    let batchId = batch_id;
    if (!batchId) {
      const [latest] = await pool.execute("SELECT batch_id FROM evaluation_results WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1", [req.user.id]);
      batchId = latest.length > 0 ? latest[0].batch_id : null;
    }
    if (!batchId) return res.json(Res.success([]));
    const [rows] = await pool.execute("SELECT * FROM evaluation_results WHERE user_id = ? AND batch_id = ?", [req.user.id, batchId]);
    if (rows.length === 0) return res.json(Res.success([]));
    const record = rows[0];
    const { aScores, bScores, scores } = extractScoreData(record.dimension_scores);
    const student = await getStudentInfo(req.user.id);
    const gradeLevels = await getGradeLevels();
    const dims = calcDimensions({ aScores, bScores, scores });

    const dimItemsMap = {
      de: [{ label:'思想政治表现 A1',rawScore:aScores.A1||0,maxScore:20,weight:'×0.25' },{ label:'道德品质修养 A2',rawScore:aScores.A2||0,maxScore:20,weight:'×0.25' },{ label:'学习态度作风 A3',rawScore:aScores.A3||0,maxScore:20,weight:'×0.25' },{ label:'组织纪律观念 A4',rawScore:aScores.A4||0,maxScore:20,weight:'×0.25' }],
      zhi: [{ label:'课程学习成绩 F2',rawScore:scores.F2||0,maxScore:100,weight:'×0.4' },{ label:'职业技能 B1',rawScore:bScores.B1||0,maxScore:30,weight:'×0.2' },{ label:'学科竞赛 B2',rawScore:bScores.B2||0,maxScore:30,weight:'×0.2' },{ label:'科研学术 B3',rawScore:bScores.B3||0,maxScore:30,weight:'×0.2' }],
      ti: [{ label:'身心健康素质 A5',rawScore:aScores.A5||0,maxScore:20,weight:'×0.4' },{ label:'文体竞赛 B7',rawScore:bScores.B7||0,maxScore:30,weight:'×0.6' }],
      mei: [{ label:'宣传报道 B4',rawScore:bScores.B4||0,maxScore:30,weight:'×1.0' }],
      lao: [{ label:'社会实践 B6',rawScore:bScores.B6||0,maxScore:30,weight:'×0.5' },{ label:'劳动教育 B8',rawScore:bScores.B8||0,maxScore:30,weight:'×0.3' },{ label:'社会工作 B5',rawScore:bScores.B5||0,maxScore:30,weight:'×0.2' }],
    };

    const allDimensions = DIM_CONFIG.map(d => ({ ...d, score: dims[d.key], levelLabel: getLevel(dims[d.key], gradeLevels).label }));

    const profiles = [];
    for (const d of DIM_CONFIG) {
      const dimData = { ...d, score: dims[d.key], levelLabel: getLevel(dims[d.key], gradeLevels).label, items: dimItemsMap[d.key] || [] };
      try {
        const aiResult = await aiDimProfile(student, dimData, allDimensions);
        if (aiResult) { profiles.push({ key: d.key, summary: aiResult.summary, level: getLevel(dims[d.key], gradeLevels), score: dims[d.key] }); continue; }
      } catch (e) { /* fallback */ }
      profiles.push({ key: d.key, summary: generateFallbackSummary(d, dims[d.key], student), level: getLevel(dims[d.key], gradeLevels), score: dims[d.key] });
    }
    res.json(Res.success(profiles, "source:ai"));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.generateSummary = async (req, res) => {
  try {
    const { batch_id } = req.body || {};
    let batchId = batch_id;
    if (!batchId) {
      const [latest] = await pool.execute("SELECT batch_id FROM evaluation_results WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1", [req.user.id]);
      batchId = latest.length > 0 ? latest[0].batch_id : null;
    }
    if (!batchId) return res.json(Res.error("暂无评定数据"));
    const [rows] = await pool.execute("SELECT * FROM evaluation_results WHERE user_id = ? AND batch_id = ?", [req.user.id, batchId]);
    if (rows.length === 0) return res.json(Res.error("暂无评定数据"));
    const record = rows[0];
    const { aScores, bScores, scores, rank } = extractScoreData(record.dimension_scores);
    const student = await getStudentInfo(req.user.id);
    const dims = calcDimensions({ aScores, bScores, scores });
    const totalScore = record.total_score || calcF(scores);

    let formItems = [];
    try {
      const [forms] = await pool.execute("SELECT id FROM assessment_forms WHERE student_id = ? AND batch_id = ? ORDER BY id DESC LIMIT 1", [req.user.id, batchId]);
      if (forms.length > 0) {
        const [items] = await pool.execute("SELECT title, reason, score FROM assessment_form_items WHERE form_id = ? ORDER BY sort_order", [forms[0].id]);
        formItems = items;
      }
    } catch (e) {}

    const itemsText = formItems.length ? formItems.map(it => `- ${it.title}：${it.reason}（${it.score}分）`).join("\n") : "暂无详细记录";

    const prompt = `你是高校学生年度个人总结撰写助手。请根据以下学生真实数据，用第一人称撰写一份年度个人总结摘要。

## 学生信息
姓名：${student.name}，年级：${student.grade}，专业：${student.major}

## 综测成绩
总分${totalScore}分，班级排名第${rank||'?'}名
五维：${DIM_CONFIG.map(d=>d.name+(dims[d.key]||0)+'分').join('、')}

## 本年度活动记录
${itemsText}

## 要求
用 JSON 返回：{"summary":"年度总结（300-450字，第一人称，分四段：思想德育、学习竞赛、文体实践、年度复盘。语气真诚朴实像学生自己写的，不用'该生'称谓，用'我'。去除分数和等级，侧重经历描述和成长感悟）"}
`;

    try {
      const { generateReport: _aiGen, generateDimensionProfile: _aiDim } = require("../services/aiService");
      const res2 = await fetch("https://api.deepseek.com/chat/completions", {
        method:"POST",
        headers:{"Content-Type":"application/json","Authorization":`Bearer ${process.env.DEEPSEEK_API_KEY}`},
        body:JSON.stringify({model:process.env.DEEPSEEK_MODEL||"deepseek-chat",messages:[{role:"user",content:prompt}],temperature:0.7,max_tokens:800})
      });
      if (res2.ok) {
        const j = await res2.json();
        const t = (j.choices?.[0]?.message?.content||"").replace(/```json\s*/g,"").replace(/```\s*/g,"").trim();
        const r = JSON.parse(t);
        return res.json(Res.success({ summary: r.summary, source: "ai" }, "生成成功"));
      }
    } catch (e) { console.log("[summary] AI失败:", e.message); }

    res.json(Res.success({
      summary: `本学年我认真完成各项学习任务，综测总分${totalScore}分。在思想品德方面，我遵守校纪校规，积极参加班级活动。学习上我努力完成专业课程，在课余参与了部分实践活动。回顾全年，我在时间规划和活动参与方面还有提升空间，下一学年将继续努力，争取更全面的发展。`,
      source: "template"
    }, "生成成功（模板）"));
  } catch (e) { res.json(Res.error(e.message)); }
};

function generateFallbackSummary(d, score, student) {
  const lv = score >= 90 ? '优秀' : score >= 80 ? '良好' : score >= 70 ? '中等' : score >= 60 ? '合格' : '待提升';
  const map = { de:'思想政治表现和道德品质', zhi:'课程学习与学术能力', ti:'身体素质和文体活动', mei:'文艺创作与宣传报道', lao:'社会实践与劳动参与' };
  return `你在${map[d.key] || d.desc}方面获得${Math.round(score)}分，等级为${lv}。继续加油！`;
}

exports.generateTrendSummary = async (req, res) => {
  try {
    const { semesters } = req.body || {};
    if (!semesters || semesters.length < 2) return res.json(Res.success({ cards: [] }));
    const aiResult = await aiTrendSummary({ semesters });
    if (aiResult?.cards?.length) return res.json(Res.success(aiResult, "AI趋势总结生成成功"));
    res.json(Res.success({ cards: [] }));
  } catch (e) { res.json(Res.error(e.message)); }
};