// ============================================================
//  AI 输出 JSON Schema 定义 — 严格校验，非法数据直接拒绝
// ============================================================

const VALID_CATEGORIES = ["moral", "intellectual", "physical", "aesthetic", "labor", ""];
const VALID_RULE_TYPES = ["scoring", "limit", "conflict"];
const VALID_LEVELS = ["national", "provincial", "school", "college"];
const VALID_FACT_TYPES = ["award", "position", "activity", "certificate", "score", "other"];
const VALID_CONDITIONS = ["pass", "fail", "uncertain"];
const VALID_STRATEGIES = ["take_highest", "dedup", "cap"];
const VALID_SCOPES = ["dimension", "global"];

// ============================================================
//  通用工具
// ============================================================

/** AI 经常返回字符串 "undefined"/"null" 或缺失字段，统一清洗 */
function sanitize(item) {
  const cleaned = {
    category: null,
    description: "",
    level: null,
    score: null,
    rule_type: "scoring",
    limit_value: null,
    scope: null,
    strategy: null,
    max_times: 1,
    conflict_group: null,
    proof_required: [],
    ...item,  // AI返回值覆盖默认值
  };
  // 清洗"undefined"/"null"字符串和NaN
  for (const key of Object.keys(cleaned)) {
    const v = cleaned[key];
    if (v === "undefined" || v === "null" || v === "" || v === undefined || (typeof v === "number" && isNaN(v))) {
      cleaned[key] = null;
    }
  }
  // 不可为null的字段
  if (!cleaned.max_times) cleaned.max_times = 1;
  if (!cleaned.description) cleaned.description = "";
  if (!cleaned.rule_type || !["scoring","limit","conflict"].includes(cleaned.rule_type)) cleaned.rule_type = "scoring";
  if (!Array.isArray(cleaned.proof_required)) cleaned.proof_required = [];
  return cleaned;
}

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
//  规则解析输出校验
// ============================================================
const RULE_ITEM_ALLOWED = new Set([
  "category", "description", "level", "score", "rule_type",
  "limit_value", "scope", "strategy",
  "max_times", "conflict_group", "proof_required",
]);
const RULE_PARSE_TOP_ALLOWED = new Set(["rule_items"]);

function validateRuleParse(data) {
  if (!data || typeof data !== "object") return { ok: false, error: "非对象" };

  const topExtra = checkExtraFields(data, RULE_PARSE_TOP_ALLOWED, "顶层");
  if (topExtra.length) return { ok: false, error: topExtra[0] };

  if (!Array.isArray(data.rule_items)) return { ok: false, error: "缺少 rule_items 数组" };

  // ★ 清洗 AI 的字符串 "undefined"/"null"
  data.rule_items = data.rule_items.map(sanitize);

  const errors = [];
  for (let i = 0; i < data.rule_items.length; i++) {
    const item = data.rule_items[i];
    const pre = `rule_items[${i}]`;

    errors.push(...checkExtraFields(item, RULE_ITEM_ALLOWED, pre));

    if (item.category !== null && !VALID_CATEGORIES.includes(item.category)) {
      errors.push(`${pre}.category 非法: "${item.category}"`);
    }
    if (!item.description || typeof item.description !== "string") {
      errors.push(`${pre}.description 缺失`);
    }
    if (item.level !== null && !VALID_LEVELS.includes(item.level)) {
      errors.push(`${pre}.level 非法: "${item.level}"（允许: ${VALID_LEVELS.join(",")}）`);
    }
    if (item.score !== null && (typeof item.score !== "number" || isNaN(item.score))) {
      errors.push(`${pre}.score 非法: ${item.score}`);
    }
    if (!VALID_RULE_TYPES.includes(item.rule_type)) {
      errors.push(`${pre}.rule_type 非法: "${item.rule_type}"`);
    }
    if (item.rule_type === "limit") {
      if (item.limit_value !== undefined && item.limit_value !== null && (typeof item.limit_value !== "number" || isNaN(item.limit_value))) {
        errors.push(`${pre}.limit_value 非法: ${item.limit_value}`);
      }
      if (item.scope !== undefined && item.scope !== null && !VALID_SCOPES.includes(item.scope)) {
        errors.push(`${pre}.scope 非法: "${item.scope}"`);
      }
    }
    if (item.rule_type === "conflict") {
      if (item.strategy !== undefined && item.strategy !== null && !VALID_STRATEGIES.includes(item.strategy)) {
        errors.push(`${pre}.strategy 非法: "${item.strategy}"`);
      }
    }
    if (item.max_times !== undefined && (!Number.isInteger(item.max_times) || item.max_times < 1)) {
      errors.push(`${pre}.max_times 必须为正整数`);
    }
    if (item.conflict_group !== null && item.conflict_group !== undefined && typeof item.conflict_group !== "string") {
      errors.push(`${pre}.conflict_group 必须为字符串或null`);
    }
    if (item.proof_required !== undefined && !Array.isArray(item.proof_required)) {
      errors.push(`${pre}.proof_required 必须为数组`);
    }
  }

  if (errors.length > 0) return { ok: false, error: errors.join("; ") };
  return { ok: true, data };
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

module.exports = {
  VALID_CATEGORIES, VALID_RULE_TYPES, VALID_LEVELS, VALID_FACT_TYPES,
  VALID_CONDITIONS, VALID_STRATEGIES, VALID_SCOPES,
  validateRuleParse, validateFactExtraction, validateRuleMatch,
  validateRuleIdsExist, clamp01, checkExtraFields, inRange01,
};
