// ============================================================
//  V3.0 Rule Matching - deterministic text similarity, no AI
// ============================================================

const { matchSummaryToRules, matchFactsToRulesBatch } = require("./textSimilarityMatcher");
const { VERSION } = require("./prompts");

async function matchFactsToRules(facts, ruleItems, userId) {
  if (!facts.length || !ruleItems.length) return { candidates: [], final_category: "", explanation: "" };
  const summaryText = facts.map(f => {
    const parts = [f.value || ""];
    if (f.detail && typeof f.detail === "object") {
      parts.push(Object.entries(f.detail).filter(([,v]) => v != null).map(([k,v]) => k + ": " + v).join(", "));
    }
    if (f.source_text) parts.push(f.source_text);
    return parts.filter(Boolean).join("; ");
  }).join("\n");
  const mr = await matchSummaryToRules(summaryText, facts[0], null, userId);
  if (!mr.best_match || mr.error) return { candidates: [], final_category: "", explanation: mr.error || "No match", match_method: "tfidf_similarity" };
  const mc = mr.match_condition, best = mr.best_match;
  const candidates = mr.candidates.map(c => ({
    rule_id: c.rule_id, condition: mc,
    basis: "Sim " + Math.round(c.similarity*100) + "%",
    match_confidence: c.similarity, fact_ids: facts.map(f => f.fact_id), final_confidence: c.similarity
  }));
  const explanation = mc === "pass" ? (best.rule_name||"") + " sim=" + Math.round(best.similarity*100) + "%" : "No match";
  return { candidates, final_category: mc === "pass" ? (best.rule_category||"") : "", explanation, model: "tfidf-cosine", prompt_version: VERSION, match_method: "tfidf_similarity", raw_match_result: mr };
}

async function matchFactsToRulesV2(facts, execRules, ruleSetId) {
  if (!facts.length || !execRules.length) return { candidates: [], final_category: "", explanation: "" };
  const summaryText = facts.map(f => [f.value||"", f.detail?JSON.stringify(f.detail):""].filter(Boolean).join(":")).join("\n");
  const batchResults = await matchFactsToRulesBatch(facts, summaryText, ruleSetId, null);
  const first = batchResults[0];
  if (!first || !first.best_match) return { candidates: [], final_category: "", explanation: "No match" };
  const mc = first.match_condition, best = first.best_match;
  const candidates = first.candidates.map(c => ({
    rule_id: c.rule_id, condition: mc, basis: "TF-IDF:"+c.similarity,
    match_confidence: c.similarity, fact_ids: facts.map(f => f.fact_id), final_confidence: c.similarity,
    rule_canonical_key: c.rule_name, rule_name: c.rule_name
  }));
  return { candidates, final_category: mc === "pass" ? (best.rule_type||"") : "",
    explanation: mc === "pass" ? (best.rule_name||"") + " sim=" + Math.round(best.similarity*100) + "%" : "No match",
    model: "tfidf-cosine", prompt_version: VERSION, rule_set_id: ruleSetId,
    match_method: "tfidf_similarity", raw_match_result: first };
}

module.exports = { matchFactsToRules, matchFactsToRulesV2 };
