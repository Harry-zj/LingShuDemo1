// ============================================================
//  V3.0 Material Pipeline
//  Phase 1: AI extracts facts | Phase 2: AI rule matching
//  Phase 3: score preview
// ============================================================

const { pool } = require("../../../config/database");
const { extractFacts } = require("./factExtractor");
const { matchSummaryToRules } = require("./textSimilarityMatcher");
const { chatStream, chatStreamJson } = require("./deepseek");

function log(step, detail) {
  const msg = typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 300);
  console.log(`[Material] ${step}`, msg);
}

// ============================================================
//  Phase 1: Extract facts from attachments
// ============================================================
async function extractMaterialFacts(materialId, userId) {
  log('Phase1:start', `materialId=${materialId}`);

  const [mats] = await pool.execute(
    "SELECT * FROM materials WHERE id = ? AND user_id = ?", [materialId, userId]
  );
  if (!mats.length) throw new Error("material not found");

  const [attachments] = await pool.execute(
    "SELECT * FROM attachments WHERE material_id = ?", [materialId]
  );
  if (!attachments.length) throw new Error("no attachments");

  const [ruleSets] = await pool.execute(
    `SELECT rs.*,
      (SELECT COUNT(*) FROM scoring_rules WHERE rule_set_id = rs.id AND status = 'active') AS rule_count
     FROM rule_sets rs
     WHERE rs.user_id = ? AND rs.status = 'published'
     ORDER BY rs.published_at DESC LIMIT 1`, [userId]
  );
  if (!ruleSets.length) throw new Error("no published rule set");

  const ruleSet = ruleSets[0];
  const factResult = await extractFacts(attachments);

  for (const att of attachments) {
    const factsFromThis = factResult.facts.filter(f => f.attachment_id === att.id);
    const label = factsFromThis.length > 0
      ? factsFromThis.map(f => `${f.type}:${f.value}`).slice(0, 3).join('|')
      : 'N/A';
    await pool.execute("UPDATE attachments SET ai_label = ? WHERE id = ?", [label.slice(0, 100), att.id]);
  }

  const summaryLines = factResult.facts.map(f => {
    const detailStr = f.detail && Object.keys(f.detail).length > 0
      ? '(' + Object.entries(f.detail).map(([k, v]) => `${k}: ${v}`).join(', ') + ')'
      : '';
    return `- [${f.type}] ${f.value} ${detailStr} (confidence: ${Math.round((f.confidence||0)*100)}%)`;
  });

  const summaryText = factResult.facts.length > 0
    ? `Found ${factResult.facts.length} facts:\n${summaryLines.join('\n')}\nClarity: ${Math.round((factResult.overall_clarity||0)*100)}%`
    : 'No facts extracted from attachments.';

  return {
    material_id: materialId, rule_set_id: ruleSet.id,
    facts: factResult.facts, summary_text: summaryText,
    overall_clarity: factResult.overall_clarity,
    attachment_count: attachments.length, facts_count: factResult.facts.length,
  };
}

// ============================================================
//  Phase 2: AI-powered rule matching + score preview
// ============================================================
async function calculateScorePreview(facts, ruleSetId, userId) {
  const factsArr = Array.isArray(facts) ? facts : (facts ? [facts] : []);
  log('Phase2:start', `facts=${factsArr.length} ruleSetId=${ruleSetId}`);

  const fact = factsArr[0];
  if (!fact) return { score_preview: null, explanation: 'empty fact', needs_review: true };

  const factDesc = buildFactDescription(fact);
  const [scoringRules] = await pool.execute(
    `SELECT id, item_key, item_name, score_level, score_rank, score, keywords, description
     FROM scoring_rules WHERE status = 'active' AND (rule_set_id = ? OR (user_id = ? AND batch_id IS NULL))
     ORDER BY item_key, score_level, score_rank`,
    [ruleSetId || 0, userId]
  );
  if (!scoringRules.length) return { score_preview: null, explanation: 'no rules', needs_review: true };

  let matchResult = null;
  try { matchResult = await aiMatchRule(factDesc, scoringRules); }
  catch (e) { log('Phase2:AI-fail', e.message); }

  if (!matchResult || !matchResult.matched_rule_id) {
    log('Phase2:fallback', 'using TF-IDF');
    const summaryText = buildSummaryText(factsArr);
    const tfidf = await matchSummaryToRules(summaryText, factsArr[0], ruleSetId, userId);
    matchResult = {
      matched_rule_id: tfidf.best_match?.rule_id || null,
      confidence: tfidf.best_match?.similarity || 0,
      reason: tfidf.best_match?.rule_name || 'TF-IDF',
    };
  }

  const matchedRule = scoringRules.find(r => r.id === matchResult.matched_rule_id);
  if (!matchedRule) return { score_preview: null, explanation: 'no match', needs_review: true };

  const score = matchedRule.score != null ? Number(matchedRule.score) : null;
  const conf = matchResult.confidence || 0;
  const ruleName = `${matchedRule.item_name||''} ${matchedRule.score_level||''} ${matchedRule.score_rank||''}`.trim();
  log('Phase2:done', `matched=${ruleName} score=${score} conf=${Math.round(conf*100)}% reason=${matchResult.reason}`);

  return {
    score_preview: score, score,
    matched_rule: { id: matchedRule.id, name: ruleName, category: matchedRule.item_key||'', level: matchedRule.score_level||'', type: 'scoring', source: 'scoring_rules' },
    matched_rule_id: matchedRule.id, indicator_code: matchedRule.item_key||'', indicator_name: matchedRule.item_name||'',
    explanation: matchResult.reason || ruleName,
    human_readable: matchResult.reason || ruleName,
    classification_status: conf >= 0.7 ? 'matched' : 'uncertain',
    needs_review: conf < 0.7, confidence: conf, similarity_score: conf,
    candidates: [], match_method: 'ai_deepseek', rule_set_id: ruleSetId,
  };
}

// ============================================================
//  AI Rule Matching
// ============================================================
async function aiMatchRule(factDesc, rules) {
  const rulesReadable = rules.map(r => {
    const p = [];
    p.push(`[${r.id}] ${r.item_name||''}`);
    if (r.score_level) p.push(`级别:${r.score_level}`);
    if (r.score_rank) p.push(`奖项:${r.score_rank}`);
    p.push(`加分:${r.score}分`);
    if (r.keywords) p.push(`关键词:${r.keywords}`);
    return p.join(' ');
  }).join('\n');

  const prompt = `请根据以下事实，从规则列表中选出最匹配的一条。

=== 事实 ===
${factDesc}

=== 计分规则（${rules.length}条） ===
${rulesReadable}

=== 要求 ===
1. 类别语义匹配（如"数学建模"属于"学科竞赛"）
2. 级别匹配（provincial=省级=省部级, national=国家级, school=校级, college=院级）
3. 奖项等次匹配（三等奖=三（铜奖）=三等奖/铜奖）

直接输出JSON: {"matched_rule_id":数字,"confidence":0.0-1.0,"reason":"理由"}`;

  const messages = [
    { role: "system", content: "你是综测规则匹配专家。只输出JSON。" },
    { role: "user", content: prompt }
  ];

  const result = await chatStreamJson(messages, { temperature: 0.1, maxTokens: 300 });
  if (!result || typeof result.matched_rule_id !== 'number') {
    throw new Error('AI invalid: ' + JSON.stringify(result));
  }
  return result;
}

// ============================================================
//  Helpers
// ============================================================
function buildFactDescription(fact) {
  const d = fact.detail || {};
  const p = [];
  if (fact.type) p.push(`类型: ${fact.type}`);
  if (fact.value) p.push(`活动: ${fact.value}`);
  if (d.level) p.push(`级别: ${d.level}`);
  else if (fact.inferred_level) p.push(`级别: ${fact.inferred_level}`);
  if (d.rank) p.push(`奖项: ${d.rank}`);
  else if (fact.award_rank) p.push(`奖项: ${fact.award_rank}`);
  if (d.organizer) p.push(`主办方: ${d.organizer}`);
  if (fact.source_text) p.push(`原文: ${fact.source_text.slice(0,200)}`);
  return p.join('\n');
}

function buildSummaryText(factsArr) {
  return factsArr.map(f => {
    const p = [];
    if (f.type) p.push(`[${f.type}]`);
    if (f.value) p.push(f.value);
    if (f.detail && typeof f.detail === 'object') {
      const det = Object.entries(f.detail).filter(([,v]) => v != null && v !== '')
        .map(([k,v]) => `${k}:${v}`).join(', ');
      if (det) p.push(`(${det})`);
    }
    if (f.source_text) p.push(f.source_text);
    return p.join(' ');
  }).join(' | ');
}

// ============================================================
//  AI-generated human-readable description
// ============================================================
async function generateDescription(fact, matchedRule, score) {
  const name = fact.competition_name || fact.award_name || fact.value || '未知活动';
  const rank = fact.award_rank || '';
  const level = fact.inferred_level || (fact.detail?.level) || '';
  const itemName = matchedRule?.item_name || matchedRule?.rule_name || '';
  const itemKey = matchedRule?.item_key || matchedRule?.category || '';
  try {
    const prompt = `根据以下信息生成一句话加分描述（20字以内）：\n活动：${name}\n奖项：${rank}\n级别：${level}\n加分：${score || 0}分\n类别：${itemName}(${itemKey})\n\n模板格式：在{活动}中获得{奖项}，属于{itemName}类别，加{score}分\n直接输出描述，不要引号，不要其他文字。`;
    const stream = await chatStream([{ role: 'user', content: prompt }], { temperature: 0.3, maxTokens: 80 });
    let text = '';
    for await (const chunk of stream) { text += chunk; }
    return text.trim() || `在${name}中获得${rank}，加${score || 0}分`;
  } catch (_) {
    return `在${name}中获得${rank}，加${score || 0}分`;
  }
}

module.exports = { extractMaterialFacts, calculateScorePreview, generateDescription };
