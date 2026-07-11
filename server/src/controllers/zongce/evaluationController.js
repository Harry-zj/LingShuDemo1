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
