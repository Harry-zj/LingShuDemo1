const { chatStreamJson } = require("./deepseek");
const { RULE_MATCH_SYSTEM, VERSION } = require("./prompts");
const { validateRuleMatch, validateRuleIdsExist, clamp01 } = require("./schemas");
const { pool } = require("../../../config/database");

// ============================================================
//  事实 + 规则 → 匹配判断
//  统一 candidates 数组，引用 fact_id，违规记日志
// ============================================================
async function matchFactsToRules(facts, ruleItems, userId) {
  if (!facts.length || !ruleItems.length) {
    return { candidates: [], final_category: "", explanation: "" };
  }

  // ★ 只传必要字段，不传 score
  const rulesForAI = ruleItems.map((r) => ({
    id: r.id,
    category: r.category,
    description: r.description,
    level: r.level,
    rule_type: r.rule_type,
    limit_value: r.limit_value,
    scope: r.scope,
    strategy: r.strategy,
    conflict_group: r.conflict_group,
    proof_required: r.proof_required,
  }));

  // ★ 只传 fact_id + type + value + detail
  const factsForAI = facts.map((f) => ({
    fact_id: f.fact_id,
    type: f.type,
    value: f.value,
    detail: f.detail,
  }));

  const messages = [
    { role: "system", content: RULE_MATCH_SYSTEM },
    {
      role: "user",
      content: `=== 可用规则 ===\n${JSON.stringify(rulesForAI, null, 2)}\n\n=== 提取的事实 ===\n${JSON.stringify(factsForAI, null, 2)}`,
    },
  ];

  const rawResult = await chatStreamJson(messages, { temperature: 0.1, maxTokens: 2048 });

  // ★ 校验（内部记录 score 违规日志）
  const valid = validateRuleMatch(rawResult);
  if (!valid.ok) {
    throw new Error("AI匹配结果校验失败: " + valid.error);
  }
  if (valid.violations && valid.violations.length > 0) {
    console.warn(`[RuleMatch] AI 违规（已记录不阻塞）: ${valid.violations.length} 条`);
  }

  const candidates = rawResult.candidates || [];

  // ★ 校验 rule_ids 真实性
  const allRuleIds = [...new Set(candidates.map((c) => c.rule_id))];
  const idCheck = await validateRuleIdsExist(pool, userId, allRuleIds);
  if (!idCheck.ok) throw new Error(idCheck.error);

  // ★ 代码计算最终置信度
  const enriched = candidates.map((c) => ({
    ...c,
    final_confidence: calcFinalConfidence(c, facts),
  }));

  // pass 优先，按置信度降序
  enriched.sort((a, b) => {
    if (a.condition === "pass" && b.condition !== "pass") return -1;
    if (b.condition === "pass" && a.condition !== "pass") return 1;
    return b.final_confidence - a.final_confidence;
  });

  const passed = enriched.filter((c) => c.condition === "pass");
  const category = passed.length > 0
    ? (ruleItems.find((r) => r.id === passed[0].rule_id) || {}).category || ""
    : "";

  const explanation = buildExplanation(enriched, facts, ruleItems);

  return {
    candidates: enriched,
    final_category: category,
    explanation,
    model: "deepseek-chat",
    prompt_version: VERSION,
    raw_match_result: rawResult,
  };
}

// ============================================================
//  综合置信度（代码决定）
// ============================================================
function calcFinalConfidence(candidate, facts) {
  const aiConf = candidate.match_confidence || 0;
  // 从 fact_ids 关联的事实计算清晰度
  const linkedFacts = candidate.fact_ids
    ? facts.filter((f) => candidate.fact_ids.includes(f.fact_id))
    : facts;
  const clarity = linkedFacts.length > 0
    ? linkedFacts.reduce((s, f) => s + (f.confidence || 0), 0) / linkedFacts.length
    : 0;
  const completeness = candidate.condition === "pass" ? 0.9
    : candidate.condition === "uncertain" ? 0.4 : 0;

  return clamp01(+(aiConf * 0.5 + clarity * 0.3 + completeness * 0.2).toFixed(4));
}

// ============================================================
//  解释文本（分数从数据库读）
// ============================================================
function buildExplanation(candidates, facts, ruleItems) {
  const passed = candidates.filter((c) => c.condition === "pass");
  const uncertain = candidates.filter((c) => c.condition === "uncertain");

  const parts = [];

  for (const c of passed) {
    const rule = ruleItems.find((r) => r.id === c.rule_id);
    if (!rule) continue;
    const scoreText = rule.score != null ? `+${rule.score}分` : "";
    const factRefs = c.fact_ids?.length
      ? `（依据: ${c.fact_ids.map((fid) => {
        const f = facts.find((x) => x.fact_id === fid);
        return f ? f.value : fid;
      }).join(", ")}）`
      : "";
    parts.push(`${rule.description}${scoreText ? "（" + scoreText + "）" : ""}：${c.basis || ""}${factRefs}`);
  }

  if (uncertain.length > 0) {
    parts.push(`⚠️ ${uncertain.length} 项不确定，需人工确认`);
  }

  return parts.join("；") || "未找到匹配的加分规则，建议人工审核。";
}

// ============================================================
//  V2 规则匹配：executable_rules 格式
// ============================================================
async function matchFactsToRulesV2(facts, execRules, ruleSetId) {
  if (!facts.length || !execRules.length) {
    return { candidates: [], final_category: "", explanation: "" };
  }

  // 映射 V2 executable_rule → AI 可读格式（不传 config 细节，只传匹配字段）
  const rulesForAI = execRules.map((r) => ({
    id: r.id,
    canonical_key: r.canonical_key,
    rule_type: r.rule_type,
    name: r.name,
    application_scope: r.application_scope,
    execution_stage: r.execution_stage,
    condition_config: r.condition_config,
    proof_required: r.proof_required,
  }));

  const factsForAI = facts.map((f) => ({
    fact_id: f.fact_id,
    type: f.type,
    value: f.value,
    detail: f.detail,
  }));

  const messages = [
    { role: "system", content: RULE_MATCH_SYSTEM },
    {
      role: "user",
      content: `=== 可用规则 ===\n${JSON.stringify(rulesForAI, null, 2)}\n\n=== 提取的事实 ===\n${JSON.stringify(factsForAI, null, 2)}`,
    },
  ];

  const rawResult = await chatStreamJson(messages, { temperature: 0.1, maxTokens: 2048 });

  const valid = validateRuleMatch(rawResult);
  if (!valid.ok) throw new Error("AI匹配结果校验失败: " + valid.error);
  if (valid.violations?.length) console.warn(`[RuleMatch] AI 违规: ${valid.violations.length} 条`);

  const candidates = (rawResult.candidates || []).map((c) => {
    // 校验 rule_id 指向真实 executable_rule
    const exists = execRules.find(r => r.id === c.rule_id);
    if (!exists) {
      console.warn(`[RuleMatch] AI 返回虚构 rule_id: ${c.rule_id}`);
      return null;
    }
    return {
      ...c,
      final_confidence: calcFinalConfidence(c, facts),
      rule_canonical_key: exists.canonical_key,
      rule_name: exists.name,
    };
  }).filter(Boolean);

  candidates.sort((a, b) => {
    if (a.condition === "pass" && b.condition !== "pass") return -1;
    if (b.condition === "pass" && a.condition !== "pass") return 1;
    return b.final_confidence - a.final_confidence;
  });

  const passed = candidates.filter((c) => c.condition === "pass");
  const finalCategory = passed.length > 0
    ? (execRules.find(r => r.id === passed[0].rule_id) || {}).execution_stage || ""
    : "";

  const explanation = buildExplanationV2(candidates, facts, execRules);

  return {
    candidates,
    final_category: finalCategory,
    explanation,
    model: "deepseek-chat",
    prompt_version: VERSION,
    rule_set_id: ruleSetId,
    raw_match_result: rawResult,
  };
}

function buildExplanationV2(candidates, facts, execRules) {
  const passed = candidates.filter((c) => c.condition === "pass");
  const parts = [];

  for (const c of passed) {
    const rule = execRules.find((r) => r.id === c.rule_id);
    if (!rule) continue;
    const factRefs = c.fact_ids?.length
      ? `（依据: ${c.fact_ids.map((fid) => { const f = facts.find((x) => x.fact_id === fid); return f ? f.value : fid; }).join(", ")}）`
      : "";
    parts.push(`${rule.name}：${c.basis || ""}${factRefs}`);
  }

  if (parts.length === 0) return "未找到匹配规则，建议人工审核";
  return parts.join("；");
}

module.exports = { matchFactsToRules, matchFactsToRulesV2 };
