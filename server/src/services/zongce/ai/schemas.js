// ============================================================
//  AI 输出 JSON Schema 定义 — 严格校验，非法数据直接拒绝
// ============================================================

const VALID_FACT_TYPES = ["award", "position", "activity", "certificate", "score", "other"];
const VALID_CONDITIONS = ["pass", "fail", "uncertain"];

// ============================================================
//  通用工具
// ============================================================

function checkExtraFields(obj, allowed, label) {
  const extra = Object.keys(obj).filter((k) => !allowed.has(k));
  return extra.length > 0 ? [`${label} 包含非法字段: ${extra.join(", ")}`] : [];
}

function clamp01(v) {
  if (typeof v !== "number" || isNaN(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

function inRange01(v, label) {
  if (v !== null && v !== undefined && (typeof v !== "number" || isNaN(v) || v < 0 || v > 1)) {
    return `${label} 超出 0~1 范围: ${v}`;
  }
  return null;
}

// ============================================================
//  事实提取输出校验
// ============================================================
const FACT_ITEM_ALLOWED = new Set(["fact_id", "type", "value", "detail", "confidence", "source_text"]);
const FACT_TOP_ALLOWED = new Set(["facts", "overall_clarity", "missing_info"]);

function validateFactExtraction(data) {
  if (!data || typeof data !== "object") return { ok: false, error: "非对象" };

  const topExtra = checkExtraFields(data, FACT_TOP_ALLOWED, "顶层");
  if (topExtra.length) return { ok: false, error: topExtra[0] };

  if (!Array.isArray(data.facts)) return { ok: false, error: "缺少 facts 数组" };

  const clarityErr = inRange01(data.overall_clarity, "overall_clarity");
  if (clarityErr) return { ok: false, error: clarityErr };

  if (data.missing_info !== undefined && !Array.isArray(data.missing_info)) {
    return { ok: false, error: "missing_info 必须为数组" };
  }

  const errors = [];
  for (let i = 0; i < data.facts.length; i++) {
    const f = data.facts[i];
    const pre = `facts[${i}]`;

    errors.push(...checkExtraFields(f, FACT_ITEM_ALLOWED, pre));

    if (!f.type || !VALID_FACT_TYPES.includes(f.type)) {
      errors.push(`${pre}.type 非法: "${f.type}"`);
    }
    if (!f.value || typeof f.value !== "string") {
      errors.push(`${pre}.value 缺失`);
    }
    const fcErr = inRange01(f.confidence, `${pre}.confidence`);
    if (fcErr) errors.push(fcErr);
    if (f.detail !== undefined && f.detail !== null && typeof f.detail !== "object") {
      errors.push(`${pre}.detail 必须为对象或null`);
    }
  }

  if (errors.length > 0) return { ok: false, error: errors.join("; ") };
  return { ok: true, data };
}

// ============================================================
//  规则匹配输出校验（统一 candidates 数组）
// ============================================================
const CANDIDATE_ITEM_ALLOWED = new Set([
  "rule_id", "condition", "basis", "reason", "match_confidence",
  "fact_ids", "missing_info",
  "score", "suggested_score",  // ★ 放行以触发违规日志（而非被checkExtraFields拦截）
]);

function validateRuleMatch(data) {
  if (!data || typeof data !== "object") return { ok: false, error: "非对象" };

  // 兼容旧格式 matches（只告警，不拒绝）
  if (data.matches && !data.candidates) {
    console.warn("[schemas] AI 返回了旧格式 matches，请更新 Prompt 为统一 candidates 数组");
    data.candidates = data.matches;
    delete data.matches;
  }

  const topExtra = checkExtraFields(data, new Set(["candidates"]), "顶层");
  if (topExtra.length) return { ok: false, error: topExtra[0] };

  if (!Array.isArray(data.candidates)) return { ok: false, error: "缺少 candidates 数组" };

  const errors = [];
  const violations = [];

  for (let i = 0; i < data.candidates.length; i++) {
    const c = data.candidates[i];
    const pre = `candidates[${i}]`;

    errors.push(...checkExtraFields(c, CANDIDATE_ITEM_ALLOWED, pre));

    // ★ 记录 score 违规（不静默删除）
    if ("score" in c || "suggested_score" in c) {
      violations.push(`${pre} 包含禁止的 score/suggested_score 字段，已记录违规并删除`);
      delete c.score;
      delete c.suggested_score;
    }

    if (!Number.isInteger(c.rule_id) || c.rule_id < 1) {
      errors.push(`${pre}.rule_id 非法: ${c.rule_id}`);
    }
    if (!c.condition || !VALID_CONDITIONS.includes(c.condition)) {
      errors.push(`${pre}.condition 非法: "${c.condition}"`);
    }
    if (c.condition === "pass") {
      if (!c.basis || typeof c.basis !== "string") {
        errors.push(`${pre}.basis 缺失（condition=pass时必须提供）`);
      }
    }
    if (c.condition === "fail" || c.condition === "uncertain") {
      if (!c.reason && !c.missing_info) {
        // 宽松处理：fail/uncertain 至少需要 reason 或 missing_info
      }
    }
    const mcErr = inRange01(c.match_confidence, `${pre}.match_confidence`);
    if (mcErr) errors.push(mcErr);

    // fact_ids 校验
    if (c.fact_ids !== undefined) {
      if (!Array.isArray(c.fact_ids)) {
        errors.push(`${pre}.fact_ids 必须为数组`);
      } else {
        for (const fid of c.fact_ids) {
          if (typeof fid !== "string") errors.push(`${pre}.fact_ids 元素必须为字符串`);
        }
      }
    }
  }

  if (violations.length > 0) {
    console.warn(`[schemas] AI 违规记录:\n${violations.join("\n")}`);
  }

  if (errors.length > 0) return { ok: false, error: errors.join("; ") };
  return { ok: true, data, violations };
}

// ============================================================
//  校验 rule_ids 是否真实存在
// ============================================================
async function validateRuleIdsExist(pool, userId, ruleIds) {
  if (!ruleIds.length) return { ok: true };
  const [rows] = await pool.execute(
    `SELECT id FROM rule_items WHERE user_id = ? AND id IN (${ruleIds.map(() => "?").join(",")}) AND status = 'confirmed'`,
    [userId, ...ruleIds]
  );
  const existing = new Set(rows.map((r) => r.id));
  const missing = ruleIds.filter((id) => !existing.has(id));
  if (missing.length > 0) {
    return { ok: false, error: `虚构的规则ID: ${missing.join(",")}（数据库中不存在或未确认）` };
  }
  return { ok: true };
}

// ============================================================
//  V2 规则解析输出校验
// ============================================================
function validateV2RuleParse(data) {
  if (!data || typeof data !== "object") return { ok: false, error: "非对象" };
  if (!Array.isArray(data.indicators)) return { ok: false, error: "缺少 indicators" };
  if (!Array.isArray(data.packages)) return { ok: false, error: "缺少 packages" };

  const errors = [];

  // 校验指标
  const allKeys = new Set();
  const checkIndicators = (nodes, parentCode) => {
    for (const n of nodes) {
      if (!n.code || !n.name) errors.push(`indicator 缺 code/name`);
      if (!n.canonical_key) errors.push(`indicator ${n.code} 缺 canonical_key`);
      if (n.canonical_key && allKeys.has(n.canonical_key)) errors.push(`重复 canonical_key: ${n.canonical_key}`);
      if (n.canonical_key) allKeys.add(n.canonical_key);
      // calc_method 不严格限制枚举，AI 会给出语义合理的值
      if (n.calc_method && typeof n.calc_method !== 'string')
        errors.push(`indicator ${n.code} calc_method 非字符串`);
      if (n.max_score != null && (typeof n.max_score !== 'number' || n.max_score < 0))
        errors.push(`indicator ${n.code} max_score 非法`);
      if (n.children) checkIndicators(n.children, n.code);
    }
  };
  checkIndicators(data.indicators, null);

  // 校验规则包
  const pkgKeys = new Set();
  for (const p of data.packages) {
    if (!p.name || !p.canonical_key) errors.push(`package 缺 name/key`);
    if (p.canonical_key && pkgKeys.has(p.canonical_key)) errors.push(`重复 pkg key: ${p.canonical_key}`);
    if (p.canonical_key) pkgKeys.add(p.canonical_key);
    if (p.auto_level && !['automatic','assisted','manual_required'].includes(p.auto_level))
      errors.push(`pkg ${p.canonical_key} auto_level 非法`);
    if (!Array.isArray(p.rules)) errors.push(`pkg ${p.canonical_key} 缺 rules`);
  }

  // 校验可执行规则
  const VALID_V2_TYPES = ['fixed','per_unit','tiered','lookup','formula_ast','coefficient','cap','dedup','eligibility','manual','normalization','evidence_policy','override','outcome_constraint','adjustment'];
  const VALID_STAGES = ['precheck','normalization','eligibility','base_score','adjustment','override','deduplication','cap','aggregation','post_aggregation','outcome'];
  const VALID_SCOPES = ['per_fact','per_material','per_group','per_indicator','global'];

  for (const p of data.packages) {
    const ruleKeys = new Set();
    for (const r of (p.rules || [])) {
      if (!r.rule_type || !VALID_V2_TYPES.includes(r.rule_type))
        errors.push(`rule ${r.canonical_key}: type 非法 "${r.rule_type}"`);
      if (!r.canonical_key) errors.push(`rule in ${p.canonical_key} 缺 key`);
      if (r.canonical_key && ruleKeys.has(r.canonical_key)) errors.push(`重复 rule key: ${r.canonical_key}`);
      if (r.canonical_key) ruleKeys.add(r.canonical_key);
      if (!r.execution_stage || !VALID_STAGES.includes(r.execution_stage))
        errors.push(`rule ${r.canonical_key}: stage 非法 "${r.execution_stage}"`);
      if (r.application_scope && !VALID_SCOPES.includes(r.application_scope))
        errors.push(`rule ${r.canonical_key}: scope 非法`);
      if (r.config && typeof r.config !== 'object')
        errors.push(`rule ${r.canonical_key}: config 非对象`);
      if (r.auto_level && !['automatic','assisted','manual_required'].includes(r.auto_level))
        errors.push(`rule ${r.canonical_key}: auto_level 非法`);
    }
  }

  // 校验查分表
  if (data.lookup_tables) {
    for (const t of data.lookup_tables) {
      if (!t.name || !t.canonical_key) errors.push(`lookup 缺 name/key`);
      if (t.dimensions && !Array.isArray(t.dimensions)) errors.push(`lookup ${t.canonical_key} dimensions 非数组`);
    }
  }

  if (errors.length > 0) return { ok: false, error: errors.join("; ") };
  return { ok: true, data };
}

module.exports = {
  VALID_FACT_TYPES, VALID_CONDITIONS,
  validateFactExtraction, validateRuleMatch,
  validateV2RuleParse,
  validateRuleIdsExist, clamp01, checkExtraFields, inRange01,
};
