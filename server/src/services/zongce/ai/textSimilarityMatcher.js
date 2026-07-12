// ============================================================
// Text Similarity Matcher - replaces AI rule matching
// Layered: structured filtering + TF-IDF cosine similarity
// Pure JS, zero dependencies, deterministic
// ============================================================

const { pool } = require("../../../config/database");

// Chinese Bigram tokenizer
function bigramTokenize(text) {
  if (!text || typeof text !== "string") return [];
  const cleaned = text.replace(/[\u3000-\u303F\uFF00-\uFFEF\s\n\r\t]+/g, "");
  const tokens = [];
  for (let i = 0; i < cleaned.length - 1; i++) {
    tokens.push(cleaned.slice(i, i + 2));
  }
  for (const ch of cleaned) tokens.push(ch);
  return tokens;
}

// TF computation
function computeTF(tokens) {
  const tf = {};
  const total = tokens.length || 1;
  for (const t of tokens) tf[t] = (tf[t] || 0) + 1;
  for (const k of Object.keys(tf)) tf[k] = tf[k] / total;
  return tf;
}

// IDF computation
function computeIDF(documents) {
  const idf = {};
  const N = documents.length;
  for (const docTokens of documents) {
    const seen = new Set(docTokens);
    for (const t of seen) idf[t] = (idf[t] || 0) + 1;
  }
  for (const k of Object.keys(idf)) {
    idf[k] = Math.log((N + 1) / (idf[k] + 1)) + 1;
  }
  return idf;
}

function tfidfVector(tf, idf) {
  const vec = {};
  for (const [term, tfVal] of Object.entries(tf)) {
    vec[term] = tfVal * (idf[term] || 0);
  }
  return vec;
}

// Cosine similarity
function cosineSimilarity(vecA, vecB) {
  let dot = 0, normA = 0, normB = 0;
  const allTerms = new Set([...Object.keys(vecA), ...Object.keys(vecB)]);
  for (const t of allTerms) {
    const a = vecA[t] || 0, b = vecB[t] || 0;
    dot += a * b; normA += a * a; normB += b * b;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Jaccard keyword overlap
function keywordOverlapScore(textA, textB) {
  const setA = new Set(bigramTokenize(textA));
  const setB = new Set(bigramTokenize(textB));
  let intersect = 0;
  for (const t of setA) { if (setB.has(t)) intersect++; }
  const union = new Set([...setA, ...setB]).size;
  return union > 0 ? intersect / union : 0;
}

// Structured field match bonus
function structuredMatchScore(factMeta, rule) {
  let score = 0;
  if (factMeta.type && rule.rule_type) {
    const ruleTypeMap = {
      award: ['scoring','lookup','fixed'],
      activity: ['scoring','per_unit'],
      position: ['scoring','fixed'],
      certificate: ['scoring'],
      score: ['scoring'],
    };
    const matchTypes = ruleTypeMap[factMeta.type] || [];
    if (matchTypes.includes(rule.rule_type) || rule.rule_type === 'scoring') {
      score += 0.3;
    }
  }
  if (factMeta.level && rule.level) {
    if (factMeta.level === rule.level) score += 0.4;
    else if (
      (factMeta.level === 'national' && rule.level === 'provincial') ||
      (factMeta.level === 'provincial' && rule.level === 'national')
    ) score += 0.15;
  }
  if (factMeta.category && rule.category) {
    if (factMeta.category === rule.category) score += 0.3;
  }
  return Math.min(score, 1.0);
}

// Extract structured labels from summary text (handles both AI and frontend fact formats)
function extractMetaFromSummary(summaryText, fact) {
  // Determine type: prefer AI format, fall back to frontend fields
  let type = fact?.type || 'other';
  if (!fact?.type && fact) {
    if (fact.competition_name || fact.award_name || fact.award_rank) type = 'award';
    else if (fact.position_name || fact.is_team) type = 'position';
    else if (fact.activity_name) type = 'activity';
  }

  const meta = { type, level: null, category: null, keywords: [] };

  // Extract level from multiple sources (frontend format first, then AI detail, then summary text)
  if (fact?.inferred_level) {
    if (/国家|全国|部级/.test(fact.inferred_level)) meta.level = 'national';
    else if (/省/.test(fact.inferred_level)) meta.level = 'provincial';
    else if (/校|院/.test(fact.inferred_level)) meta.level = 'school';
  }
  if (!meta.level && fact?.detail) {
    const d = fact.detail;
    const hint = d.level_hint || d.level || '';
    if (/国家|全国|部级/.test(hint)) meta.level = 'national';
    else if (/省[^国]|省级/.test(hint)) meta.level = 'provincial';
    else if (/校[^外]|校级|院级/.test(hint)) meta.level = 'school';
  }
  if (!meta.level && summaryText) {
    if (/国家|全国|部级/.test(summaryText)) meta.level = 'national';
    else if (/省[^国]|省级/.test(summaryText)) meta.level = 'provincial';
    else if (/校[^外]|校级|院级/.test(summaryText)) meta.level = 'school';
  }

  const typeCategoryMap = { award: 'intellectual', activity: 'practice', position: 'moral', certificate: 'intellectual', score: 'intellectual' };
  meta.category = typeCategoryMap[meta.type] || 'intellectual';

  if (summaryText) {
    const patterns = [/竞赛|大赛|比赛|挑战杯|数学建模/g, /志愿|公益|实践|三下乡/g,
      /干部|学生会|班级|团支部|社长/g, /论文|专利|发表|期刊|SCI|EI/g,
      /文体|艺术|文艺|体育|运动会/g, /荣誉|优秀|先进|标兵|三好/g,
      /证书|四级|六级|普通话|计算机|雅思|托福/g];
    for (const p of patterns) {
      const m = summaryText.match(p); if (m) meta.keywords.push(...m);
    }
    const tokens = bigramTokenize(summaryText);
    const freq = {}; for (const t of tokens) { if (t.length >= 2) freq[t] = (freq[t] || 0) + 1; }
    meta.keywords.push(...Object.entries(freq).filter(([,c]) => c >= 2).map(([t]) => t).slice(0, 10));
  }
  return meta;
}

// Main matching function
async function matchSummaryToRules(summaryText, fact, ruleSetId, userId) {
  const result = { candidates: [], best_match: null, match_method: 'tfidf_similarity', confidence: 0 };
  if (!summaryText || !summaryText.trim()) return { ...result, error: 'empty summary' };

  const factMeta = extractMetaFromSummary(summaryText, fact);

  // V3: Single table query - scoring_rules
  let [scoringRules] = await pool.execute(
    `SELECT id, rule_set_id, user_id, section, item_key, item_name,
            score_level, score_rank, score, keywords, description,
            max_score, dedup_group
     FROM scoring_rules
     WHERE status = 'active' AND (user_id = ? OR rule_set_id = ?)
     ORDER BY item_key, score_level, score_rank`,
    [userId, ruleSetId || 0]
  );

  // Normalize to common format
  const allRules = scoringRules.map(r => ({
    ...r,
    rule_type: 'scoring',
    name: `${r.item_name || ''} ${r.score_level || ''} ${r.score_rank || ''}`,
    category: r.item_key || '',
    level: r.score_level || '',
    source: 'scoring_rules',
    score: r.score,
  }));

  if (!allRules.length) return { ...result, error: 'no rules available' };

  // Build rule text descriptions
  const ruleTexts = allRules.map(r => {
    const parts = [];
    if (r.item_key) parts.push(r.item_key);
    if (r.item_name) parts.push(r.item_name);
    if (r.score_level) parts.push(r.score_level);
    if (r.score_rank) parts.push(r.score_rank);
    if (r.keywords) parts.push(r.keywords);
    if (r.description) parts.push(r.description);
    return parts.join(' ');
  });

  const allTexts = [summaryText, ...ruleTexts];
  const allTokens = allTexts.map(t => bigramTokenize(t));
  const idf = computeIDF(allTokens);
  const queryTF = computeTF(allTokens[0]);
  const queryVec = tfidfVector(queryTF, idf);

  // Score every rule
  const scored = allRules.map((rule, idx) => {
    const ruleTF = computeTF(allTokens[idx + 1] || []);
    const ruleVec = tfidfVector(ruleTF, idf);
    const tfidfScore = cosineSimilarity(queryVec, ruleVec);
    const jaccardScore = keywordOverlapScore(summaryText, ruleTexts[idx] || '');
    const structScore = structuredMatchScore(factMeta, rule);
    const combined = tfidfScore * 0.60 + jaccardScore * 0.15 + structScore * 0.25;
    return { rule, tfidf_score: +tfidfScore.toFixed(3), jaccard_score: +jaccardScore.toFixed(3),
      struct_score: +structScore.toFixed(3), combined_score: +combined.toFixed(3) };
  });

  scored.sort((a, b) => b.combined_score - a.combined_score);

  const top = scored.slice(0, 5).map(s => ({
    rule_id: s.rule.id, rule_name: s.rule.name || s.rule.description || '',
    rule_category: s.rule.category || '', rule_level: s.rule.level || '',
    rule_type: s.rule.rule_type || '', score_value: s.rule.score != null ? Number(s.rule.score) : null,
    similarity: s.combined_score, tfidf: s.tfidf_score,
    jaccard: s.jaccard_score, struct: s.struct_score, source: s.rule.source,
  }));

  const best = top[0] || null;
  const condition = best && best.similarity >= 0.35 ? 'pass'
    : (best && best.similarity >= 0.20 ? 'uncertain' : 'fail');

  return { candidates: top, best_match: best, match_condition: condition,
    match_method: 'tfidf_similarity', confidence: best ? best.similarity : 0,
    needs_review: condition !== 'pass', fact_meta: factMeta };
}

// Batch matching
async function matchFactsToRulesBatch(facts, summaryText, ruleSetId, userId) {
  const results = [];
  for (const fact of facts) {
    const factSummary = [fact.value || '',
      fact.detail ? Object.entries(fact.detail).filter(([,v]) => v != null)
        .map(([k,v]) => k + ':' + v).join(',') : '',
      fact.source_text || ''].filter(Boolean).join('; ');
    const mr = await matchSummaryToRules(factSummary || summaryText, fact, ruleSetId, userId);
    results.push({ fact_id: fact.fact_id, fact, ...mr });
  }
  return results;
}

module.exports = { bigramTokenize, computeTF, computeIDF, tfidfVector,
  cosineSimilarity, keywordOverlapScore, structuredMatchScore,
  extractMetaFromSummary, matchSummaryToRules, matchFactsToRulesBatch };