const { pool } = require("../config/database"); const Res = require("../utils/response");

// 获取评定结果
exports.getEvaluation = async (req, res) => {
  try {
    const { batch_id } = req.query;
    const [rows] = await pool.execute(
      "SELECT * FROM evaluation_results WHERE student_id = ?" + (batch_id ? " AND batch_id = ?" : "") + " ORDER BY created_at DESC LIMIT 1",
      batch_id ? [req.user.id, batch_id] : [req.user.id]
    );
    res.json(Res.success(rows[0] || null));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 生成评定报告
exports.generateReport = async (req, res) => {
  try {
    const { batch_id } = req.body;
    const studentId = req.user.id;

    // 查找评定记录
    const [evals] = await pool.execute(
      "SELECT * FROM evaluation_results WHERE student_id = ?" + (batch_id ? " AND batch_id = ?" : "") + " ORDER BY created_at DESC LIMIT 1",
      batch_id ? [studentId, batch_id] : [studentId]
    );
    if (!evals.length) return res.json(Res.error("暂无评定数据，无法生成报告"));

    const ev = evals[0];
    const dims = typeof ev.dimension_scores === "string" ? JSON.parse(ev.dimension_scores) : (ev.dimension_scores || {});
    const dimNames = { zhiyu: "智育", deyu: "德育", tiyu: "体育", meiyu: "美育", laoyu: "劳育" };

    // 找最高和最低维度
    let bestKey = "", worstKey = "", bestVal = 0, worstVal = 100;
    for (const [k, v] of Object.entries(dims)) {
      if (v > bestVal) { bestVal = v; bestKey = k; }
      if (v < worstVal) { worstVal = v; worstKey = k; }
    }

    // 生成报告文本
    const reportLines = [
      `综测总分：${ev.total_score} 分`,
      `班级排名：第 ${ev.class_rank || "--"} 名 / 共 ${ev.class_size || "--"} 人`,
      "",
      "【维度得分明细】",
      ...Object.entries(dims).map(([k, v]) => `  ${dimNames[k] || k}：${v} 分`),
      "",
      `【优势分析】你在「${dimNames[bestKey]}」维度表现最为突出（${bestVal}分），展现了该领域的扎实积累与优秀能力。`,
      `【提升方向】「${dimNames[worstKey]}」维度有较大提升空间（${worstVal}分），建议下阶段重点突破。`,
      "",
      "【综合评价】",
      ev.total_score >= 85 ? "整体表现优秀，各维度发展均衡，望继续保持并争创更好成绩。" :
      ev.total_score >= 70 ? "整体表现良好，部分维度已具备竞争力，持续努力可更上一层楼。" :
      ev.total_score >= 60 ? "整体表现尚可，但部分维度有待加强，建议制定专项提升计划。" :
      "整体表现需重点提升，各维度均有较大进步空间，建议积极调整策略。"
    ];
    const reportContent = reportLines.join("\n");

    // 生成建议
    const advice = [];
    const sorted = Object.entries(dims).sort((a, b) => b[1] - a[1]);
    if (sorted[0]) advice.push({ type: "strength", title: `持续巩固「${dimNames[sorted[0][0]]}」优势`, content: `你在${dimNames[sorted[0][0]]}领域表现优异（${sorted[0][1]}分），建议在此基础上继续深入发展，争取成为核心优势领域。` });
    if (sorted[1]) advice.push({ type: "strength", title: `发挥「${dimNames[sorted[1][0]]}」带动作用`, content: `${dimNames[sorted[1][0]]}维度得分${sorted[1][1]}分，可作为第二增长点，带动综测总分提升。` });
    if (sorted[4]) advice.push({ type: "weakness", title: `重点提升「${dimNames[sorted[4][0]]}」维度`, content: `${dimNames[sorted[4][0]]}维度目前得分${sorted[4][1]}分，建议分析薄弱原因，积极参与相关活动与实践，补齐短板。` });
    if (sorted[3]) advice.push({ type: "weakness", title: `关注「${dimNames[sorted[3][0]]}」维度发展`, content: `${dimNames[sorted[3][0]]}维度得分${sorted[3][1]}分，仍有一定提升空间，可作为下阶段努力方向之一。` });

    // 更新数据库
    await pool.execute(
      "UPDATE evaluation_results SET report_content = ?, advice = ? WHERE id = ?",
      [reportContent, JSON.stringify(advice), ev.id]
    );

    res.json(Res.success({ report_content: reportContent, advice }, "报告生成成功"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 班级统计
exports.getClassStats = async (req, res) => {
  try {
    const { batch_id } = req.query;
    const studentId = req.user.id;

    // 获取学生班级
    const [users] = await pool.execute("SELECT class_id FROM users WHERE id = ?", [studentId]);
    if (!users.length || !users[0].class_id) return res.json(Res.success({ avg_score: 0, class_size: 0, my_rank: null, rankings: [], dimension_averages: {} }));

    const classId = users[0].class_id;

    // 同班同学在指定批次的评定
    const [rows] = await pool.execute(
      "SELECT er.student_id, u.real_name, er.total_score, er.dimension_scores " +
      "FROM evaluation_results er JOIN users u ON er.student_id = u.id " +
      "WHERE u.class_id = ?" + (batch_id ? " AND er.batch_id = ?" : "") + " ORDER BY er.total_score DESC",
      batch_id ? [classId, batch_id] : [classId]
    );

    if (!rows.length) return res.json(Res.success({ avg_score: 0, class_size: 0, my_rank: null, rankings: [], dimension_averages: {} }));

    const total = rows.reduce((s, r) => s + parseFloat(r.total_score || 0), 0);
    const avgScore = (total / rows.length).toFixed(2);
    const myRow = rows.find(r => r.student_id === studentId);
    const myRank = myRow ? rows.indexOf(myRow) + 1 : null;

    // 计算各维度班级均值
    const dimSums = { zhiyu: 0, deyu: 0, tiyu: 0, meiyu: 0, laoyu: 0 };
    let validCount = 0;
    for (const r of rows) {
      const dims = typeof r.dimension_scores === "string" ? JSON.parse(r.dimension_scores) : (r.dimension_scores || {});
      if (Object.keys(dims).length === 0) continue;
      validCount++;
      for (const [k, v] of Object.entries(dims)) {
        if (dimSums.hasOwnProperty(k)) dimSums[k] += parseFloat(v || 0);
      }
    }
    const dimAverages = {};
    if (validCount > 0) {
      for (const k of Object.keys(dimSums)) dimAverages[k] = parseFloat((dimSums[k] / validCount).toFixed(1));
    }

    const rankings = rows.map((r, i) => ({ rank: i + 1, student_id: r.student_id, real_name: r.real_name, total_score: r.total_score }));

    res.json(Res.success({
      avg_score: parseFloat(avgScore),
      class_size: rows.length,
      my_rank: myRank,
      rankings,
      dimension_averages: dimAverages,
    }));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 发展建议
exports.getAdvice = async (req, res) => {
  try {
    const { batch_id } = req.query;
    const studentId = req.user.id;
    const dimNames = { zhiyu: "智育", deyu: "德育", tiyu: "体育", meiyu: "美育", laoyu: "劳育" };

    const [evals] = await pool.execute(
      "SELECT dimension_scores FROM evaluation_results WHERE student_id = ?" + (batch_id ? " AND batch_id = ?" : "") + " ORDER BY created_at DESC LIMIT 1",
      batch_id ? [studentId, batch_id] : [studentId]
    );

    if (!evals.length) return res.json(Res.success([]));

    const dims = typeof evals[0].dimension_scores === "string" ? JSON.parse(evals[0].dimension_scores) : (evals[0].dimension_scores || {});
    const sorted = Object.entries(dims).sort((a, b) => b[1] - a[1]);
    const advice = [];

    if (sorted[0]) advice.push({ type: "strength", title: `继续保持「${dimNames[sorted[0][0]]}」优势`, content: `在${dimNames[sorted[0][0]]}领域表现突出（${sorted[0][1]}分），展现了扎实的能力基础，建议在此方向上继续深耕。` });
    if (sorted[4]) advice.push({ type: "weakness", title: `重点提升「${dimNames[sorted[4][0]]}」维度`, content: `${dimNames[sorted[4][0]]}得分相对较低（${sorted[4][1]}分），建议多参与相关实践活动，拓展该领域经历，争取全面提升。` });
    if (sorted[3] && sorted[3][1] < 70) advice.push({ type: "weakness", title: `同步加强「${dimNames[sorted[3][0]]}」`, content: `${dimNames[sorted[3][0]]}维度（${sorted[3][1]}分）同样存在提升空间，可结合日常学习生活逐步改善。` });

    res.json(Res.success(advice));
  } catch (e) { res.json(Res.error(e.message)); }
};
