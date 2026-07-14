// ============================================================
//  V3.0 Material Pipeline
//  Phase 1: AI extracts facts | Phase 2: AI rule matching
//  Phase 3: score preview
// ============================================================

const { pool } = require("../../../config/database");
const { extractFacts } = require("./factExtractor");
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

  // ★ 关键字段校验：如果事实数据缺失严重，直接返回
  const factDesc = buildFactDescription(fact);
  if (!factDesc || factDesc.split('\n').length < 2) {
    log('Phase2:skip', `事实信息不完整，跳过AI匹配: ${factDesc}`);
    return { score_preview: null, explanation: '事实信息不完整，请重新提取材料', needs_review: true };
  }

  log('Phase2:fact', `desc=${factDesc.replace(/\n/g,' | ').slice(0,200)}`);

  // ★ 查询当前规则集的活跃规则
  let [scoringRules] = await pool.execute(
    `SELECT id, item_key, item_name, score_level, score_rank, score, keywords, description
     FROM scoring_rules WHERE status = 'active' AND rule_set_id = ?
     ORDER BY item_key, score_level, score_rank`,
    [ruleSetId || 0]
  );
  log('Phase2:rules', `查询到 ${scoringRules.length} 条规则(ruleSetId=${ruleSetId})`);
  if (!scoringRules.length) {
    log('Phase2:none', '规则集无活跃计分规则');
    return { score_preview: null, explanation: '规则集无活跃计分规则', needs_review: true };
  }

  // ★ 如果规则太多，按事实级别预筛选（减少 AI 上下文窗口压力）
  if (scoringRules.length > 100) {
    const rawLevel = extractLevel(fact);
    const factLevel = normalizeLevel(rawLevel);
    log('Phase2:filter', `rawLevel="${rawLevel}" factLevel="${factLevel}" fact.type="${fact.type}"`);
    if (factLevel) {
      const relevantLevels = getRelevantLevels(factLevel);
      const filtered = scoringRules.filter(r => {
        const ruleLevel = normalizeLevel(r.score_level || '');
        return !ruleLevel || relevantLevels.includes(ruleLevel);
      });
      if (filtered.length > 0 && filtered.length < scoringRules.length) {
        log('Phase2:filter', `按级别"${factLevel}"预筛选: ${scoringRules.length} → ${filtered.length} 条`);
        scoringRules = filtered;
      }
    }
  }

  // ★ 纯 AI 匹配，最多重试 2 次
  let matchResult = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      matchResult = await aiMatchRule(factDesc, scoringRules, attempt);
      if (matchResult && typeof matchResult.matched_rule_id === 'number') break;
      log('Phase2:AI-retry', `attempt=${attempt} result=${JSON.stringify(matchResult)}`);
    } catch (e) { log('Phase2:AI-fail', `attempt=${attempt} ${e.message}`); }
  }

  if (!matchResult || typeof matchResult.matched_rule_id !== 'number') {
    log('Phase2:none', 'AI 未能匹配到规则');
    return { score_preview: null, explanation: 'AI 未能匹配到计分规则，请检查规则集配置', needs_review: true };
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
async function aiMatchRule(factDesc, rules, attempt = 1) {
  const rulesReadable = rules.map(r => {
    const p = [];
    p.push(`[${r.id}] ${r.item_name||''}(${r.item_key||''})`);
    if (r.score_level) p.push(`级别:${r.score_level}`);
    if (r.score_rank) p.push(`奖项:${r.score_rank}`);
    p.push(`加分:${r.score}分`);
    if (r.keywords) p.push(`关键词:${r.keywords}`);
    return p.join(' ');
  }).join('\n');

  const temp = attempt === 1 ? 0.1 : 0.3;
  const prompt = `请根据以下事实，匹配到最合适的一条计分规则。即使事实类型标注为"other"，也要根据活动名称和详情判断其类别。

=== 事实 ===
${factDesc}

=== 计分规则（${rules.length}条） ===
${rulesReadable}

=== 匹配要点 ===
1. 类别语义：根据活动名称判断类别（如"数学建模"→B2学科竞赛，"志愿服务"→B6社会实践，"学生会"→B5社会工作）
2. 级别匹配：international→国家级, provincial→省级, school→校级, college→院级
3. 奖项等次：一等奖=金奖, 二等奖=银奖, 三等奖=铜奖=Honorable Mention
4. 如果事实类型为"other"，忽略类型字段，只根据活动名称、级别、奖项来匹配

直接输出JSON，不要解释：
{"matched_rule_id":数字,"confidence":0.0-1.0,"reason":"一句话理由"}`;

  const messages = [
    { role: "system", content: "你是高校综测计分规则匹配专家。根据事实的语义和级别匹配最合适的规则。必须输出有效JSON。" },
    { role: "user", content: prompt }
  ];

  const result = await chatStreamJson(messages, { temperature: temp, maxTokens: 1024 });
  if (!result || typeof result.matched_rule_id !== 'number') {
    throw new Error('AI invalid: ' + JSON.stringify(result));
  }
  return result;
}

// ============================================================
//  Helpers
// ============================================================
function buildFactDescription(fact) {
  // AI 返回的 fact_data 结构: {type, value, detail:{level, rank, organizer, ...}, source_text, ...}
  // 旧格式可能: {type, value, award_name, award_rank, inferred_level, organizer, ...}
  const raw = fact.detail || {};
  const d = (raw.detail && typeof raw.detail === 'object') ? raw.detail : raw;
  log('Phase2:desc', `rawKeys=${Object.keys(raw).slice(0,8).join(',')} dKeys=${Object.keys(d).slice(0,5).join(',')} type=${fact.type} value=${fact.value}`);
  const p = [];
  if (fact.type) p.push(`类型: ${fact.type}`);
  if (fact.value) p.push(`名称: ${fact.value}`);
  else if (raw.award_name) p.push(`名称: ${raw.award_name}`);
  else if (raw.competition_name) p.push(`名称: ${raw.competition_name}`);
  // 级别（从多个可能位置读取）
  const level = d.level || raw.level || raw.inferred_level || fact.inferred_level || d.inferred_level || '';
  if (level) p.push(`级别: ${level}`);
  // 奖项等次
  const rank = d.rank || raw.rank || raw.award_rank || fact.award_rank || d.award_rank || '';
  if (rank) p.push(`奖项: ${rank}`);
  // 主办方
  const org = d.organizer || raw.organizer || raw.organizer_name || '';
  if (org) p.push(`主办方: ${org}`);
  // 日期
  const date = d.date || raw.date || '';
  if (date) p.push(`日期: ${date}`);
  // 原文
  if (fact.source_text) p.push(`原文: ${fact.source_text.slice(0, 200)}`);
  else if (raw.source_text) p.push(`原文: ${raw.source_text.slice(0, 200)}`);
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

// ★ 从事実中提取级别信息
function extractLevel(fact) {
  const raw = fact.detail || {};
  const d = (raw.detail && typeof raw.detail === 'object') ? raw.detail : raw;
  return d.level || raw.level || raw.inferred_level || fact.inferred_level || '';
}

// ★ 标准化级别名称
function normalizeLevel(level) {
  const m = {
    'international': 'international', '国际': 'international', '国家级': 'national',
    'national': 'national', '国家': 'national', '全国': 'national',
    'provincial': 'provincial', '省级': 'provincial', '省部': 'provincial',
    'municipal': 'municipal', '市级': 'municipal',
    'school': 'school', '校级': 'school', '院级': 'college',
    'college': 'college', '院系': 'college',
  };
  const key = (level || '').toLowerCase();
  return m[key] || key;
}

// ★ 获取相关级别列表（包含相邻级别用于模糊匹配）
function getRelevantLevels(factLevel) {
  const order = ['international', 'national', 'provincial', 'municipal', 'school', 'college'];
  const idx = order.indexOf(factLevel);
  if (idx < 0) return [factLevel]; // 未知级别，不过滤
  // 包含当前级别和相邻级别（上下各1级）
  const result = [factLevel];
  if (idx > 0) result.push(order[idx - 1]);
  if (idx < order.length - 1) result.push(order[idx + 1]);
  return result;
}

module.exports = { extractMaterialFacts, calculateScorePreview, generateDescription };
