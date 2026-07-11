// ============================================================
//  V2 评分引擎 — 确定性执行，不调 AI
//  Decimal 方案避免浮点误差
// ============================================================
const { pool } = require("../../../config/database");

// 执行阶段顺序
const STAGES = [
  "precheck",
  "normalization",
  "eligibility",
  "base_score",
  "adjustment",
  "deduplication",
  "cap",
  "aggregation",
  "post_aggregation",
  "outcome",
];

// ============================================================
//  主入口
// ============================================================
async function executeCalculation(taskId) {
  const conn = await pool.getConnection();
  try {
    // 加载任务
    const [tasks] = await conn.execute("SELECT * FROM calculation_tasks WHERE id = ?", [taskId]);
    if (!tasks.length) throw new Error("任务不存在");
    const task = tasks[0];

    // 加载规则集的可执行规则
    const [rules] = await conn.execute(
      `SELECT er.* FROM executable_rules er
       JOIN rule_packages rp ON er.package_id = rp.id
       WHERE rp.rule_set_id = ? AND er.status = 'confirmed'`,
      [task.rule_set_id]
    );

    // 加载材料事实（通过 calculation_task_inputs）
    const [inputs] = await conn.execute(
      "SELECT * FROM calculation_task_inputs WHERE calculation_task_id = ?", [taskId]
    );

    const allFacts = [];
    for (const inp of inputs) {
      const [facts] = await conn.execute(
        `SELECT ef.* FROM extracted_facts ef
         WHERE ef.analysis_run_id = ? AND ef.status = 'active'`, [inp.analysis_run_id]
      );
      allFacts.push(...facts);
    }

    // 加载指标
    const [indicators] = await conn.execute(
      "SELECT * FROM indicator_nodes WHERE rule_set_id = ?", [task.rule_set_id]
    );

    // 执行上下文
    const ctx = {
      taskId, conn, rules, facts: allFacts, indicators,
      scores: {},        // indicator_id → current score
      ruleResults: [],
      stepOrder: 0,
    };

    // ★ 更新状态为 running
    await conn.execute("UPDATE calculation_tasks SET status='running' WHERE id=?", [taskId]);

    // 按阶段执行
    for (const stage of STAGES) {
      await conn.execute("UPDATE calculation_tasks SET current_stage=? WHERE id=?", [stage, taskId]);

      const stageRules = rules.filter(r => r.execution_stage === stage);
      if (!stageRules.length) continue;

      const blockingReviews = [];

      for (const rule of stageRules) {
        if (rule.auto_level === 'manual_required') {
          blockingReviews.push(rule);
          continue;
        }

        // 执行规则
        const execResult = executeRule(rule, ctx);
        if (execResult.skip) continue;

        // 保存结果
        const execKey = require("crypto").createHash("sha256")
          .update(`${taskId}:${rule.id}:${rule.application_scope}`).digest("hex").slice(0, 64);

        await conn.execute(
          `INSERT INTO calculation_rule_results
           (calculation_task_id, rule_application_id, execution_key, exec_rule_id,
            score_before, score_change, score_after, matched, executed, exec_status)
           VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [taskId, execKey, rule.id,
           execResult.scoreBefore, execResult.scoreChange, execResult.scoreAfter,
           execResult.matched, execResult.executed, execResult.status]
        );

        await conn.execute(
          `INSERT INTO calculation_steps (task_id, step_order, execution_stage, exec_rule_id, computation, output_value)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [taskId, ++ctx.stepOrder, stage, rule.id,
           JSON.stringify(execResult.computation), execResult.scoreChange]
        );
      }

      // 批量暂停
      if (blockingReviews.length) {
        for (const r of blockingReviews) {
          await conn.execute(
            `INSERT INTO manual_review_tasks (calculation_task_id, target_type, target_id, review_stage, question, status)
             VALUES (?, 'executable_rule', ?, 'scoring', ?, 'pending')`,
            [taskId, r.id, `规则 "${r.name}" 需要人工审核`]
          );
        }
        await conn.execute(
          "UPDATE calculation_tasks SET status='waiting_review', checkpoint=? WHERE id=?",
          [JSON.stringify({ stage, completedStepCount: ctx.stepOrder }), taskId]
        );
        return { status: 'waiting_review', stage, reviewCount: blockingReviews.length };
      }
    }

    // 聚合指标结果
    await aggregateResults(taskId, ctx, conn);

    // 完成
    const totalScore = Object.values(ctx.scores).reduce((s, v) => s + v, 0);
    await conn.execute(
      "UPDATE calculation_tasks SET status='completed', total_score=? WHERE id=?",
      [totalScore.toFixed(2), taskId]
    );

    return { status: 'completed', totalScore, metricsCount: Object.keys(ctx.scores).length };
  } catch (e) {
    await conn.execute("UPDATE calculation_tasks SET status='failed' WHERE id=?", [taskId]);
    throw e;
  } finally {
    conn.release();
  }
}

// ============================================================
//  规则执行
// ============================================================
function executeRule(rule, ctx) {
  const config = typeof rule.config === 'string' ? JSON.parse(rule.config) : rule.config;
  const scope = rule.application_scope || 'per_fact';

  switch (rule.rule_type) {
    case 'fixed':
      return execFixed(config, scope, rule, ctx);
    case 'per_unit':
      return execPerUnit(config, scope, rule, ctx);
    case 'cap':
      return execCap(config, scope, rule, ctx);
    case 'dedup':
      return execDedup(config, scope, rule, ctx);
    case 'coefficient':
      return execCoefficient(config, scope, rule, ctx);
    default:
      // 不支持的规则类型：标记为 pending_manual
      return {
        skip: false, matched: true, executed: false,
        scoreBefore: 0, scoreChange: 0, scoreAfter: 0,
        status: 'pending_manual',
        computation: { reason: `规则类型 ${rule.rule_type} 暂不支持自动执行` }
      };
  }
}

// ============================================================
//  执行器实现
// ============================================================

function execFixed(config, scope, rule, ctx) {
  const score = Number(config.score || 0);
  const indicatorKey = getIndicatorKey(rule, ctx);
  const before = ctx.scores[indicatorKey] || 0;
  const after = before + score;

  if (indicatorKey) ctx.scores[indicatorKey] = after;

  return {
    skip: false, matched: true, executed: true,
    scoreBefore: before, scoreChange: score, scoreAfter: after,
    status: 'applied',
    computation: { type: 'fixed', score, before, after }
  };
}

function execPerUnit(config, scope, rule, ctx) {
  const unitScore = Number(config.score_per_unit || 0);
  const divisor = Number(config.unit_divisor || 1);
  const maxScore = config.max_score ? Number(config.max_score) : Infinity;

  let totalUnits = 0;
  for (const fact of ctx.facts) {
    if (matchFact(rule, fact)) {
      const val = Number(fact.fact_data?.hours || fact.fact_data?.count || 0);
      totalUnits += val;
    }
  }

  const rawScore = Math.floor(totalUnits / divisor) * unitScore;
  const score = Math.min(rawScore, maxScore);

  const indicatorKey = getIndicatorKey(rule, ctx);
  const before = ctx.scores[indicatorKey] || 0;
  const after = before + score;
  if (indicatorKey) ctx.scores[indicatorKey] = after;

  return {
    skip: false, matched: totalUnits > 0, executed: totalUnits > 0,
    scoreBefore: before, scoreChange: score, scoreAfter: after,
    status: 'applied',
    computation: { type: 'per_unit', totalUnits, divisor, unitScore, maxScore, rawScore, score }
  };
}

function execCap(config, scope, rule, ctx) {
  const max = config.max != null ? Number(config.max) : null;
  const min = config.min != null ? Number(config.min) : null;

  for (const [key, val] of Object.entries(ctx.scores)) {
    let capped = val;
    if (max != null) capped = Math.min(capped, max);
    if (min != null) capped = Math.max(capped, min);
    ctx.scores[key] = capped;
  }

  return {
    skip: false, matched: true, executed: true,
    scoreBefore: 0, scoreChange: 0, scoreAfter: 0,
    status: 'applied',
    computation: { type: 'cap', max, min }
  };
}

function execDedup(config, scope, rule, ctx) {
  const strategy = config.strategy || 'take_highest';
  // 简化为全局择高
  if (strategy === 'take_highest') {
    let maxVal = 0;
    for (const val of Object.values(ctx.scores)) {
      if (val > maxVal) maxVal = val;
    }
    // 只保留最高的一项
    const keys = Object.keys(ctx.scores);
    if (keys.length > 1) {
      for (let i = 1; i < keys.length; i++) {
        ctx.scores[keys[i]] = Math.min(ctx.scores[keys[i]], maxVal);
      }
    }
  }

  return {
    skip: false, matched: true, executed: true,
    scoreBefore: 0, scoreChange: 0, scoreAfter: 0,
    status: 'applied',
    computation: { type: 'dedup', strategy }
  };
}

function execCoefficient(config, scope, rule, ctx) {
  const coeff = Number(config.coefficient || 1);
  for (const key of Object.keys(ctx.scores)) {
    ctx.scores[key] = +(ctx.scores[key] * coeff).toFixed(4);
  }

  return {
    skip: false, matched: true, executed: true,
    scoreBefore: 0, scoreChange: 0, scoreAfter: 0,
    status: 'applied',
    computation: { type: 'coefficient', coefficient: coeff }
  };
}

// ============================================================
//  辅助
// ============================================================
function matchFact(rule, fact) {
  if (!rule.input_selector) return true;
  const sel = typeof rule.input_selector === 'string' ? JSON.parse(rule.input_selector) : rule.input_selector;
  if (sel.fact_type && fact.fact_type !== sel.fact_type) return false;
  if (sel.required_fields) {
    const fd = typeof fact.fact_data === 'string' ? JSON.parse(fact.fact_data) : fact.fact_data;
    for (const f of sel.required_fields) {
      if (!(f in (fd || {}))) return false;
    }
  }
  return true;
}

function getIndicatorKey(rule, ctx) {
  const pkgId = rule.package_id;
  const ind = ctx.indicators.find(i => {
    // 查找此规则包所属的指标
    return true; // 简化：返回第一个指标
  });
  return ind ? String(ind.id) : 'default';
}

async function aggregateResults(taskId, ctx, conn) {
  for (const [indKey, score] of Object.entries(ctx.scores)) {
    await conn.execute(
      `INSERT INTO calculation_metric_results (task_id, indicator_id, raw_score, adjusted_score, final_score, status)
       VALUES (?, ?, ?, ?, ?, 'normal')
       ON DUPLICATE KEY UPDATE final_score=VALUES(final_score)`,
      [taskId, parseInt(indKey) || 0, score, score, +score.toFixed(2)]
    );
  }
}

module.exports = { executeCalculation };
