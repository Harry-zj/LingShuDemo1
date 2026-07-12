const { pool } = require("../../config/database");
const Res = require("../../utils/response");
const { executeCalculation } = require("../../services/zongce/engine/scoringEngine");

// 创建计算任务并执行
exports.calculateScore = async (req, res) => {
  try {
    const { rule_set_id, material_ids } = req.body;
    if (!rule_set_id) return res.json(Res.error("请选择规则集"));

    // 验证规则集已发布
    const [rs] = await pool.execute("SELECT * FROM rule_sets WHERE id = ?", [rule_set_id]);
    if (!rs.length) return res.json(Res.error("规则集不存在"));
    if (rs[0].status !== 'published') return res.json(Res.error("规则集未发布"));

    // 锁定材料分析版本
    const materialIds = material_ids || [];
    const inputs = [];
    for (const mid of materialIds) {
      const [runs] = await pool.execute(
        "SELECT id FROM material_analysis_runs WHERE material_id = ? AND status='completed' ORDER BY completed_at DESC LIMIT 1",
        [mid]
      );
      if (!runs.length) continue;
      inputs.push({ material_id: mid, analysis_run_id: runs[0].id });
    }

    if (!inputs.length) return res.json(Res.error("没有可用的材料分析结果"));

    // 创建计算任务
    const [task] = await pool.execute(
      `INSERT INTO calculation_tasks (rule_set_id, student_id, requested_by, status, engine_version)
       VALUES (?, ?, ?, 'pending', 'v2.0')`,
      [rule_set_id, req.user.id, req.user.id]
    );
    const taskId = task.insertId;

    // 写入任务输入
    for (const inp of inputs) {
      await pool.execute(
        "INSERT INTO calculation_task_inputs (calculation_task_id, material_id, analysis_run_id, match_run_id, input_hash) VALUES (?, ?, ?, 0, '')",
        [taskId, inp.material_id, inp.analysis_run_id]
      );
    }

    // ★ 执行评分
    const result = await executeCalculation(taskId);

    res.json(Res.success({ task_id: taskId, ...result }, result.status === 'completed' ? '评分完成' : '评分中'));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 获取计算任务详情
exports.getCalculation = async (req, res) => {
  try {
    const { id } = req.params;
    const [tasks] = await pool.execute("SELECT * FROM calculation_tasks WHERE id = ?", [id]);
    if (!tasks.length) return res.json(Res.error("任务不存在"));
    const task = tasks[0];

    // 加载规则结果
    const [ruleResults] = await pool.execute(
      "SELECT * FROM calculation_rule_results WHERE calculation_task_id = ? ORDER BY id", [id]
    );
    // 加载指标结果
    const [metricResults] = await pool.execute(
      "SELECT * FROM calculation_metric_results WHERE task_id = ?", [id]
    );
    // 加载步骤
    const [steps] = await pool.execute(
      "SELECT * FROM calculation_steps WHERE task_id = ? ORDER BY step_order", [id]
    );

    res.json(Res.success({ task, rule_results: ruleResults, metric_results: metricResults, steps }));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 恢复暂停的计算
exports.resumeCalculation = async (req, res) => {
  try {
    const { id } = req.params;
    const [tasks] = await pool.execute("SELECT * FROM calculation_tasks WHERE id = ?", [id]);
    if (!tasks.length) return res.json(Res.error("任务不存在"));
    if (tasks[0].status !== 'waiting_review') return res.json(Res.error("任务不在等待审核状态"));

    await pool.execute("UPDATE calculation_tasks SET status='resuming' WHERE id=?", [id]);
    const result = await executeCalculation(id);
    res.json(Res.success({ task_id: id, ...result }, "计算已恢复"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 获取评估结果（V1 兼容）
exports.getEvaluation = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM calculation_tasks WHERE student_id = ? ORDER BY created_at DESC LIMIT 1",
      [req.user.id]
    );
    if (!rows.length) return res.json(Res.success(null));
    const task = rows[0];
    const [metrics] = await pool.execute(
      "SELECT * FROM calculation_metric_results WHERE task_id = ?", [task.id]
    );
    res.json(Res.success({ task, metrics }));
  } catch (e) { res.json(Res.error(e.message)); }
};

// ★ 评分清单 — 按根指标分组汇总已确认分数（只读，不写表）
exports.getScoreList = async (req, res) => {
  try {
    const ruleSetId = req.query.rule_set_id;
    if (!ruleSetId) return res.json(Res.error("请指定 rule_set_id"));

    // 1. 加载指标树
    const [indicators] = await pool.execute(
      "SELECT * FROM indicator_nodes WHERE rule_set_id = ? ORDER BY sort_order, id", [ruleSetId]
    );
    if (!indicators.length) return res.json(Res.success({ indicators: [], total_score: 0, fact_count: 0 }));

    // 2. 加载所有已确认的事实匹配
    const [rows] = await pool.execute(
      `SELECT
         m.id AS material_id, m.title AS material_title,
         ef.id AS fact_id, ef.fact_type, ef.fact_data,
         frm.id AS match_id, frm.preview_data,
         att.file_name AS source_file
       FROM fact_rule_matches frm
       JOIN extracted_facts ef ON frm.extracted_fact_id = ef.id
       JOIN material_analysis_runs mar ON ef.analysis_run_id = mar.id
       JOIN materials m ON mar.material_id = m.id
       JOIN rule_match_runs rmr ON frm.match_run_id = rmr.id
       LEFT JOIN extracted_fact_sources efs ON ef.id = efs.extracted_fact_id
       LEFT JOIN attachments att ON efs.attachment_id = att.id
       WHERE frm.review_status = 'confirmed'
         AND frm.is_current = 1
         AND m.user_id = ?
         AND rmr.rule_set_id = ?
       ORDER BY m.id, ef.id`,
      [req.user.id, ruleSetId]
    );

    // 3. 解析每条 fact 的 preview_data → 提取 indicator_code + score
    const indicatorMap = new Map(); // code → { indicator, facts[], totalScore }
    for (const ind of indicators) {
      indicatorMap.set(ind.code, { indicator: ind, facts: [], totalScore: 0 });
    }

    for (const row of rows) {
      let preview = {};
      try {
        preview = typeof row.preview_data === 'string'
          ? JSON.parse(row.preview_data) : (row.preview_data || {});
      } catch (_) {}

      const factData = typeof row.fact_data === 'string'
        ? JSON.parse(row.fact_data) : (row.fact_data || {});

      const indCode = preview.indicator?.code || '';
      const entry = indicatorMap.get(indCode);
      const fact = {
        material_id: row.material_id,
        material_title: row.material_title,
        fact_id: row.fact_id,
        fact_type: row.fact_type,
        award_name: factData.award_name || '',
        competition_name: factData.competition_name || '',
        inferred_level: factData.inferred_level || '',
        award_rank: factData.award_rank || '',
        organizer: factData.organizer || '',
        score: preview.score_preview ?? 0,
        rule_name: preview.rule?.name || '',
        rule_type: preview.rule?.rule_type || '',
        lookup_table_name: preview.lookup_table?.name || '',
        dimensions: preview.lookup_dimensions || preview.raw_dimensions || {},
        source_file: row.source_file || '',
      };
      if (entry) {
        entry.facts.push(fact);
        entry.totalScore += fact.score;
      }
    }

    // 4. 自底向上聚合：子节点分数加到父节点
    const byId = new Map();
    for (const ind of indicators) {
      byId.set(ind.id, { ...ind, children: [] });
    }
    const roots = [];
    for (const ind of indicators) {
      const node = byId.get(ind.id);
      if (ind.parent_id && byId.has(ind.parent_id)) {
        byId.get(ind.parent_id).children.push(node);
      } else {
        roots.push(node);
      }
    }

    // 聚合分数
    function aggregate(node) {
      let sum = indicatorMap.get(node.code)?.totalScore || 0;
      for (const child of node.children) {
        sum += aggregate(child);
      }
      node._score = sum;
      return sum;
    }
    let totalScore = 0;
    for (const root of roots) {
      totalScore += aggregate(root);
    }

    // 5. 构建返回：只用根节点
    const resultIndicators = roots.map(root => {
      const entry = indicatorMap.get(root.code);
      return {
        id: root.id,
        code: root.code,
        name: root.name,
        max_score: root.max_score,
        score: root._score,
        facts: entry ? entry.facts : [],
      };
    });

    res.json(Res.success({
      rule_set_id: Number(ruleSetId),
      indicators: resultIndicators,
      total_score: +totalScore.toFixed(2),
      fact_count: rows.length,
    }));
  } catch (e) {
    console.error('[Evaluation] getScoreList 失败:', e.message);
    res.json(Res.error("获取评分清单失败，请稍后重试"));
  }
};
