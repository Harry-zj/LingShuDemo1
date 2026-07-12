// ============================================================
//  两阶段 Kimi 规则匹配管线
//  Phase 1: rule cards → Kimi 选 top-k 候选业务块
//  Phase 2: 加载完整上下文 → Kimi 精确匹配+字段归一化
//  Phase 3: scoringEngine 算分
// ============================================================
const { pool } = require("../../../config/database");
const crypto = require("crypto");

function log(step, detail) {
  const msg = typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 400);
  console.log(`[MaterialMatch] ${step} ${msg}`);
}

// ============================================================
//  1. 从已发布 rule_set 构建规则卡片
// ============================================================
async function buildRuleBlockCards(ruleSetId) {
  log('buildCards', `ruleSetId=${ruleSetId}`);

  // 加载 indicators
  const [indicators] = await pool.execute(
    "SELECT * FROM indicator_nodes WHERE rule_set_id = ? ORDER BY sort_order, id", [ruleSetId]
  );

  // 加载每个 indicator 的 packages + rules + lookups
  const cards = [];
  for (const ind of indicators) {
    const [packages] = await pool.execute(
      "SELECT * FROM rule_packages WHERE rule_set_id = ? AND indicator_id = ?", [ruleSetId, ind.id]
    );
    const [rules] = await pool.execute(
      `SELECT er.* FROM executable_rules er
       JOIN rule_packages rp ON er.package_id = rp.id
       WHERE rp.indicator_id = ?`, [ind.id]
    );
    const [lookups] = await pool.execute(
      "SELECT * FROM lookup_tables WHERE rule_set_id = ?", [ruleSetId]
    );

    // 提取查表名
    const lookupNames = lookups
      .filter(lt => {
        // 简单关联：查分表名含 indicator code
        return lt.name && (lt.name.includes(ind.code) || lt.canonical_key.includes(ind.code?.toLowerCase()));
      })
      .map(lt => lt.name);

    // 提取 rule 类型分类
    const ruleTypes = [...new Set(rules.map(r => r.rule_type))];
    const exclusionRules = rules.filter(r => r.rule_type === 'eligibility' || r.execution_stage === 'eligibility');
    const capRules = rules.filter(r => r.rule_type === 'cap');

    // summary：优先 package.summary，其次 indicator.name
    const summary = packages.map(p => p.summary).filter(Boolean).join('; ')
      || `${ind.name}，包含 ${rules.length} 条规则`;

    // classification_cues：从 rule names + lookup names 提取关键词
    const ruleNames = rules.map(r => r.name).filter(Boolean);
    const cues = [...new Set([...ruleNames, ...lookupNames])].slice(0, 10);

    cards.push({
      indicator_id: ind.id,
      code: ind.code || '',
      name: ind.name || '',
      summary: summary.slice(0, 300),
      applicable_fact_types: ['award', 'activity', 'position', 'certificate', 'score', 'other'],
      classification_cues: cues,
      lookup_table_names: lookupNames,
      important_notes: exclusionRules.map(r => r.name).filter(Boolean).slice(0, 5),
      exclusion_summary: capRules.map(r => `${r.name}: max ${r.config?.max || '?'}`).filter(Boolean),
      rule_count: rules.length,
      package_count: packages.length,
      has_lookup: lookupNames.length > 0,
    });
  }

  log('buildCards', `${cards.length} cards built`);
  return cards;
}

// ============================================================
//  2. Phase 1: Kimi 从卡片中选择 top-k 候选业务块
// ============================================================
const RULE_BLOCK_SELECTION_SYSTEM = `你是高校综测规则分类器。根据材料事实，从规则业务块卡片中选择最匹配的 1~3 个候选。

=== 核心原则 ===
★ 规则定义的是业务类别和计分标准，不是所有材料名称的封闭白名单。
  不要因为竞赛/活动名称未在规则文档中原文出现就拒绝分类。
★ 根据证据判断业务类别（学科竞赛、文体艺术、社会实践、职业技能...），
  而不是根据名称是否在文档中出现。

=== 规则 ===
- 最多返回 top 3 候选，按置信度降序
- 如果没有合适的候选，needs_review=true
- 不要在这一阶段给出分数
- 只看卡片内容判断分类，不要推测卡片中没有的规则细节

=== 输出格式 ===
{
  "candidates": [
    { "indicator_id": 1, "code": "B2", "business_type": "学科竞赛", "confidence": 0.92, "reason": "材料描述的是学科竞赛获奖，主办单位为学院，属于B2学术竞赛类" }
  ],
  "needs_review": false,
  "review_reason": null
}`;

async function selectRuleBlocksWithKimi(fact, cards) {
  log('phase1:select', `fact=${fact.award_name || fact.competition_name || '?'} cards=${cards.length}`);

  if (!cards.length) return { candidates: [], needs_review: true, review_reason: '规则集无可用卡片' };

  // 精简卡片：只传关键字段给 Kimi
  const cardsForAI = cards.map(c => ({
    indicator_id: c.indicator_id,
    code: c.code,
    name: c.name,
    summary: c.summary,
    classification_cues: c.classification_cues.slice(0, 8),
    lookup_table_names: c.lookup_table_names,
    important_notes: c.important_notes,
  }));

  const factForAI = {
    fact_type: fact.fact_type,
    award_name: fact.award_name,
    competition_name: fact.competition_name,
    award_rank: fact.award_rank,
    organizer: fact.organizer,
    inferred_level: fact.inferred_level,
    source_text: fact.source_text?.slice(0, 200),
  };

  const { chatStreamJson } = require("./deepseek");
  const result = await chatStreamJson(
    [
      { role: "system", content: RULE_BLOCK_SELECTION_SYSTEM },
      { role: "user", content: `=== 材料事实 ===\n${JSON.stringify(factForAI, null, 2)}\n\n=== 规则业务块卡片 ===\n${JSON.stringify(cardsForAI, null, 2)}` },
    ],
    { temperature: 0.1, maxTokens: 1024 }
  );

  const candidates = (result.candidates || []).slice(0, 3);
  log('phase1:selected', `candidates=${candidates.map(c => c.code).join(',')} needs_review=${result.needs_review}`);

  return { candidates, needs_review: result.needs_review || false, review_reason: result.review_reason || null };
}

// ============================================================
//  3. 加载候选业务块的完整规则上下文
// ============================================================
async function loadRuleContext(ruleSetId, selectedIndicatorIds) {
  log('loadContext', `indicators=${selectedIndicatorIds.join(',')}`);

  const contexts = [];

  for (const indId of selectedIndicatorIds) {
    const [indicators] = await pool.execute(
      "SELECT * FROM indicator_nodes WHERE rule_set_id = ? AND id = ?", [ruleSetId, indId]
    );
    if (!indicators.length) continue;
    const ind = indicators[0];

    // packages
    const [packages] = await pool.execute(
      "SELECT * FROM rule_packages WHERE rule_set_id = ? AND indicator_id = ?", [ruleSetId, indId]
    );

    // executable_rules
    const [rules] = await pool.execute(
      `SELECT er.* FROM executable_rules er
       JOIN rule_packages rp ON er.package_id = rp.id
       WHERE rp.indicator_id = ?`, [indId]
    );

    // ★ 只加载与当前 indicator 关联的 lookup_tables
    // 通过 executable_rule.config.lookup_table_key 精确关联
    const lookupTableKeys = new Set();
    for (const r of rules) {
      if (r.rule_type === 'lookup') {
        let cfg = r.config;
        if (typeof cfg === 'string') cfg = JSON.parse(cfg);
        const ref = cfg.lookup_table_key || cfg.lookup_table || '';
        if (ref) lookupTableKeys.add(ref.toLowerCase());
      }
    }

    // 也通过 package key + table key 关键词关联
    const pkgKeys = packages.map(p => (p.canonical_key || '').toLowerCase());
    const [allTables] = await pool.execute(
      "SELECT * FROM lookup_tables WHERE rule_set_id = ?", [ruleSetId]
    );

    const relatedTables = allTables.filter(lt => {
      const lk = (lt.canonical_key || '').toLowerCase();
      // 条件1: rule config 直接引用
      if (lookupTableKeys.has(lk)) return true;
      // 条件2: package key 和 table key 关键词匹配
      if (pkgKeys.some(k => lk.includes(k) || k.includes(lk))) return true;
      // 条件3: 关键词交集 (competition ↔ academic_competition)
      const lkWords = lk.split(/[._-]/);
      const pkgWords = pkgKeys.flatMap(k => k.split(/[._-]/));
      if (lkWords.some(w => w.length > 3 && pkgWords.some(pw => pw.includes(w) || w.includes(pw)))) return true;
      return false;
    });

    const fullLookups = [];
    for (const lt of relatedTables) {
      const [dims] = await pool.execute("SELECT * FROM lookup_dimensions WHERE table_id = ? ORDER BY sort_order", [lt.id]);
      // ★ 加载全部 cells（不 limit），构建 dimension_schema
      const [cells] = await pool.execute("SELECT * FROM lookup_cells WHERE table_id = ?", [lt.id]);

      // ★ 构建 dimension_schema: 每个维度的全部 allowed_values
      const dimensionSchema = {};
      for (const d of dims) {
        const values = new Set();
        for (const c of cells) {
          try {
            const cellDims = typeof c.dimension_values === 'string'
              ? JSON.parse(c.dimension_values) : c.dimension_values;
            if (cellDims[d.dim_name] != null) values.add(String(cellDims[d.dim_name]));
          } catch (_) {}
        }
        // 枚举: value + 中文标签（如果有）
        const allowedValues = [...values].map(v => {
          const entry = { value: v };
          // 尝试给出中文标签（从已知映射中查找）
          return entry;
        });
        dimensionSchema[d.dim_name] = {
          dim_name: d.dim_name,
          dim_label: d.dim_label || '',
          sort_order: d.sort_order,
          allowed_values: allowedValues,
          allowed_raw: [...values],  // 简洁的字符串列表供 AI 快速判断
        };
      }

      fullLookups.push({
        id: lt.id,
        name: lt.name,
        canonical_key: lt.canonical_key,
        dimensions: dims.map(d => ({ dim_name: d.dim_name, dim_label: d.dim_label })),
        dimension_schema: dimensionSchema,   // ★ 完整维度枚举
        sample_cells: cells.slice(0, 5).map(c => ({ dims: c.dimension_values, value: c.value })),
      });
    }

    // source refs (doc_blocks referenced by these rules)
    const [refs] = await pool.execute(
      `SELECT rsr.*, db.content, db.title, db.block_type
       FROM rule_source_refs rsr
       JOIN doc_blocks db ON rsr.doc_block_id = db.id
       WHERE rsr.entity_type = 'indicator_node' AND rsr.entity_id = ?`, [indId]
    );

    contexts.push({
      indicator: { id: ind.id, code: ind.code, name: ind.name, calc_method: ind.calc_method, max_score: ind.max_score },
      packages: packages.map(p => ({ id: p.id, canonical_key: p.canonical_key, name: p.name, summary: p.summary })),
      rules: rules.map(r => ({
        id: r.id,
        canonical_key: r.canonical_key,
        rule_type: r.rule_type,
        name: r.name,
        execution_stage: r.execution_stage,
        application_scope: r.application_scope,
        config: typeof r.config === 'string' ? JSON.parse(r.config || '{}') : (r.config || {}),
        condition_config: r.condition_config ? (typeof r.condition_config === 'string' ? JSON.parse(r.condition_config) : r.condition_config) : null,
      })),
      lookup_tables: fullLookups,
      source_refs: refs.map(r => ({ id: r.id, title: r.title, content: (r.content || '').slice(0, 300), block_type: r.block_type })),
    });
  }

  const ruleCount = contexts.reduce((s, c) => s + c.rules.length, 0);
  const tableCount = contexts.reduce((s, c) => s + c.lookup_tables.length, 0);
  log('loadContext', `loaded: ${contexts.length} indicators, ${ruleCount} rules, ${tableCount} tables`);

  return contexts;
}

// ============================================================
//  4. Phase 3: Kimi 精确匹配 + 字段归一化
// ============================================================
const FACT_PRECISE_MATCH_SYSTEM = `你是高校综测规则精确匹配器。在给定的规则上下文中，判断材料事实应匹配哪条规则，并归一化所有字段。

=== 关键原则 ===
★ 后端已经提供了每张查分表的完整 dimension_schema（allowed_values 列表）。
  维度值是否合法以数据库 dimension_schema 为准，你不得声称某个 allowed_values 中的值"不存在"。
★ 你的工作是：基于事实内容，从 schema 中选择最合适的维度值，而非判断 schema 是否正确。
★ 不要因为材料或竞赛名称未在规则文档中原文出现就拒绝匹配。
  规则定义的是业务类别和计分标准，不是所有材料名称的封闭白名单。

=== 匹配优先级（必须按顺序检查） ===
1. explicit exclusion: 该事实是否命中"明确不加分"条款 → 如命中，标记为 excluded
2. special override: 是否匹配特殊换算、固定分、降级规则 → 如命中，使用特殊规则
3. standard rule / lookup: 按类别的通用规则或查分表匹配 → 这是最常见路径
4. documented fallback: 规则明确规定的默认处理
5. manual review: 确实无法确定类别、来源或关键字段时才 needs_review

=== 输出字段 ===
- selected_indicator_id / selected_rule_block: 选择的指标
- business_type: 业务类别标签（如 "学科竞赛"、"文体艺术"、"社会实践"）
- source_authority: 来源可信度判断（"可信"/"存疑"/"不可信"）
- authority_evidence: 来源判断依据
- matched_rule_ids: 匹配的规则 ID 列表
- matched_lookup_table_id: 匹配的查分表 ID（从 dimension_schema 中找到匹配的表）
- score_dimensions: 规范化的维度值（值必须在对应 dimension_schema.allowed_values 中或与 allowed_raw 一致）
- recommended_policy: "standard_lookup" | "special_override" | "explicit_exclusion" | "manual_review"
- explicit_exclusion_hit: 命中的排除规则（有则填）
- special_override_hit: 命中的特殊规则（有则填）
- confidence / needs_review / review_reason

=== 禁止 ===
- 不输出分数值
- 不得声称 dimension_schema 中明确列出的值"不存在"
- 不得因为名称陌生而拒绝分类
- 不得把规则文档当作材料名称白名单

=== 输出格式 ===
{
  "selected_indicator_id": 1,
  "selected_rule_block": "B7",
  "business_type": "学科竞赛",
  "source_authority": "可信",
  "authority_evidence": "落款为学院团委，有公章",
  "matched_rule_ids": [101, 102],
  "matched_lookup_table_id": 5,
  "score_dimensions": { "level": "college", "rank": "second" },
  "recommended_policy": "standard_lookup",
  "explicit_exclusion_hit": null,
  "special_override_hit": null,
  "confidence": 0.91,
  "needs_review": false,
  "review_reason": null
}`;

async function matchFactWithKimi(fact, ruleContexts) {
  log('phase2:match', `contexts=${ruleContexts.length}`);

  if (!ruleContexts.length) {
    return { candidates: [], needs_review: true, review_reason: '无可用规则上下文' };
  }

  // ★ 发送完整上下文给 Kimi，包含 dimension_schema
  const ctxForAI = ruleContexts.map(ctx => ({
    indicator: ctx.indicator,
    rules: ctx.rules.map(r => ({
      id: r.id,
      canonical_key: r.canonical_key,
      rule_type: r.rule_type,
      name: r.name,
      execution_stage: r.execution_stage,
      config: r.config,
      condition_config: r.condition_config,
    })),
    lookup_tables: ctx.lookup_tables.map(lt => ({
      id: lt.id,
      name: lt.name,
      canonical_key: lt.canonical_key,
      dimensions: lt.dimensions,
      dimension_schema: lt.dimension_schema,    // ★ 完整 allowed_values
      sample_cells: lt.sample_cells,
    })),
    source_refs: ctx.source_refs,
  }));

  const factForAI = {
    fact_type: fact.fact_type,
    award_name: fact.award_name,
    competition_name: fact.competition_name,
    award_rank: fact.award_rank,
    organizer: fact.organizer,
    inferred_level: fact.inferred_level,
    level_evidence: fact.level_evidence,
    award_date: fact.award_date,
    is_team: fact.is_team,
    my_role: fact.my_role,
    is_duplicate_project: fact.is_duplicate_project,
  };

  const { chatStreamJson } = require("./deepseek");
  const result = await chatStreamJson(
    [
      { role: "system", content: FACT_PRECISE_MATCH_SYSTEM },
      { role: "user", content: `=== 材料事实 ===\n${JSON.stringify(factForAI, null, 2)}\n\n=== 规则上下文 ===\n${JSON.stringify(ctxForAI, null, 2)}` },
    ],
    { temperature: 0.1, maxTokens: 2048 }
  );

  // 打印 AI 原始返回用于排查
  log('phase2:raw_result', JSON.stringify(result).slice(0, 500));
  log('phase2:matched',
    `block=${result.selected_rule_block || '(空)'} rules=${(result.matched_rule_ids || []).length} ` +
    `lookup_table_id=${result.matched_lookup_table_id || '(空)'} ` +
    `dims=${JSON.stringify(result.score_dimensions || {})} confidence=${result.confidence} needs_review=${result.needs_review}`
  );

  return result;
}

// ============================================================
//  5. 完整匹配管线（编排 Phase 1-3）
// ============================================================
async function matchFactPipeline(fact, ruleSetId, { maxRounds = 2 } = {}) {
  const failure = { reason: null, stage: null };

  // Phase 1: 构建卡片 + 选候选
  let cards;
  try {
    cards = await buildRuleBlockCards(ruleSetId);
    log('pipeline', `cards=${cards.length}`);
  } catch (e) {
    return { status: 'failed', failure_reason: 'match_not_executed', reason: `构建卡片失败: ${e.message}`, phase1_result: null };
  }

  let selection;
  try {
    selection = await selectRuleBlocksWithKimi(fact, cards);
  } catch (e) {
    return { status: 'failed', failure_reason: 'match_not_executed', reason: `Phase1 AI调用失败: ${e.message}`, phase1_result: null };
  }

  if (selection.needs_review || !selection.candidates.length) {
    return { status: 'needs_review', failure_reason: 'match_not_executed', reason: selection.review_reason || '无匹配候选', phase1_result: selection };
  }

  // Phase 2: 加载上下文 + 精确匹配
  let ruleContexts;
  try {
    const selectedIds = selection.candidates.map(c => c.indicator_id);
    ruleContexts = await loadRuleContext(ruleSetId, selectedIds);
  } catch (e) {
    return { status: 'failed', failure_reason: 'match_not_executed', reason: `加载规则上下文失败: ${e.message}`, phase1_candidates: selection.candidates };
  }

  let matchResult;
  try {
    matchResult = await matchFactWithKimi(fact, ruleContexts);
  } catch (e) {
    return { status: 'failed', failure_reason: 'match_not_executed', reason: `Phase2 AI调用失败: ${e.message}`, phase1_candidates: selection.candidates };
  }

  // 最多两轮
  let round = 1;
  while (round < maxRounds && matchResult.needs_review && selection.candidates.length > round) {
    const backupId = selection.candidates[round]?.indicator_id;
    if (!backupId) break;
    log('pipeline', `round ${round + 1}: trying backup candidate id=${backupId}`);
    try {
      ruleContexts = await loadRuleContext(ruleSetId, [backupId]);
      matchResult = await matchFactWithKimi(fact, ruleContexts);
    } catch (e) {
      log('pipeline', `round ${round + 1} failed: ${e.message}`);
      break;
    }
    round++;
  }

  // ★ 校验 Phase 2 结果完整性
  if (!matchResult.selected_rule_block && !matchResult.matched_rule_ids?.length) {
    return {
      status: 'needs_review',
      failure_reason: 'match_not_executed',
      reason: 'AI 未返回有效的规则匹配（selected_rule_block 和 matched_rule_ids 均为空）',
      phase1_candidates: selection.candidates,
      phase2_result: matchResult,
      rounds: round,
    };
  }

  return {
    status: matchResult.needs_review ? 'needs_review' : 'matched',
    failure_reason: matchResult.needs_review ? 'match_not_executed' : null,
    reason: matchResult.review_reason || null,
    phase1_candidates: selection.candidates,
    phase2_result: matchResult,
    rounds: round,
    rule_context_incomplete: ruleContexts.length === 0,
  };
}

// ============================================================
//  6. 确定性验证 + 正式匹配入库
// ============================================================
async function validateAndPersistMatch(fact, extractedFactId, analysisRunId, ruleSetId, matchResult, scorePreview, previewMeta = null) {
  const crypto = require('crypto');
  const conn = await pool.getConnection();
  let matchRunId = null;

  try {
    await conn.beginTransaction();

    // ★ 创建 rule_match_run
    const factHash = crypto.createHash('sha256')
      .update(JSON.stringify({
        award_name: fact.award_name, competition_name: fact.competition_name,
        award_rank: fact.award_rank, inferred_level: fact.inferred_level,
        organizer: fact.organizer, fact_type: fact.fact_type,
      })).digest('hex').slice(0, 64);

    const [run] = await conn.execute(
      `INSERT INTO rule_match_runs (rule_set_id, analysis_run_id, model_name, prompt_version, input_hash, status)
       VALUES (?, ?, 'deepseek-chat', 'v2.3', ?, 'running')`,
      [ruleSetId, analysisRunId, factHash]
    );
    matchRunId = run.insertId;

    // ★ 失效旧 match（同一 extracted_fact_id 的旧 current match）
    await conn.execute(
      "UPDATE fact_rule_matches SET is_current = 0 WHERE extracted_fact_id = ? AND is_current = 1",
      [extractedFactId]
    );

    const phase2 = matchResult.phase2_result || {};

    // ★ 确定性验证
    const verifications = [];

    // 1. fact → material 关系: 直接使用传入的 extractedFactId
    verifications.push({ check: 'fact_material_relation', passed: !!extractedFactId });

    // 2. rule_set 已发布
    const [rsCheck] = await conn.execute(
      "SELECT status FROM rule_sets WHERE id = ?", [ruleSetId]
    );
    verifications.push({ check: 'rule_set_published', passed: rsCheck.length > 0 && rsCheck[0].status === 'published' });

    // 3. 候选 indicator 存在且属于当前 rule_set
    const candIndicatorId = phase2.selected_indicator_id || scorePreview.indicator_id;
    let indicatorOk = false;
    if (candIndicatorId) {
      const [indCheck] = await conn.execute(
        "SELECT id FROM indicator_nodes WHERE id = ? AND rule_set_id = ?", [candIndicatorId, ruleSetId]
      );
      indicatorOk = indCheck.length > 0;
    }
    verifications.push({ check: 'indicator_in_rule_set', passed: indicatorOk });

    // 4. matched_rule_ids 存在且属于当前 rule_set
    const ruleIds = (phase2.matched_rule_ids || []).filter(Boolean);
    let rulesOk = ruleIds.length > 0;
    if (rulesOk) {
      const [ruleCheck] = await conn.execute(
        `SELECT er.id FROM executable_rules er
         JOIN rule_packages rp ON er.package_id = rp.id
         WHERE er.id IN (${ruleIds.map(() => '?').join(',')}) AND rp.rule_set_id = ?`,
        [...ruleIds, ruleSetId]
      );
      rulesOk = ruleCheck.length === ruleIds.length;
    }
    verifications.push({ check: 'rules_in_rule_set', passed: rulesOk });

    // 5. fact_type 兼容
    const [rules] = rulesOk ? await conn.execute(
      `SELECT er.id, er.rule_type, er.input_selector, er.condition_config, er.config FROM executable_rules er WHERE er.id IN (${ruleIds.map(() => '?').join(',')})`,
      ruleIds
    ) : [[], []];
    const factType = fact.fact_type || 'award';
    let factTypeOk = true;
    for (const r of rules) {
      let sel = r.input_selector;
      if (typeof sel === 'string') sel = JSON.parse(sel);
      if (sel?.fact_type && sel.fact_type !== factType) {
        factTypeOk = false;
        break;
      }
    }
    verifications.push({ check: 'fact_type_compatible', passed: factTypeOk });

    // 6. required_fields 满足
    let requiredOk = true;
    for (const r of rules) {
      let sel = r.input_selector;
      if (typeof sel === 'string') sel = JSON.parse(sel);
      if (sel?.required_fields) {
        for (const rf of sel.required_fields) {
          if (!(rf in fact) && !(rf in (scorePreview.raw_dimensions || {}))) {
            requiredOk = false;
            break;
          }
        }
      }
    }
    verifications.push({ check: 'required_fields', passed: requiredOk });

    // 7. dimensions 均已合法归一化
    const dimsOk = !scorePreview.error_type || scorePreview.error_type !== 'dimension_value_unmapped';
    verifications.push({ check: 'dimensions_normalized', passed: dimsOk });

    // 8. lookup table 属于该 rule
    const tableId = scorePreview.matched_table_id;
    let tableOk = true;
    if (tableId) {
      const [tCheck] = await conn.execute(
        "SELECT id FROM lookup_tables WHERE id = ? AND rule_set_id = ?", [tableId, ruleSetId]
      );
      tableOk = tCheck.length > 0;
    }
    verifications.push({ check: 'lookup_table_in_rule_set', passed: tableOk });

    // 9. score 来自 lookup_cells（非 AI 返回值）
    const scoreFromLookup = scorePreview.score_preview !== null && scorePreview.matched_rule !== null;
    verifications.push({ check: 'score_from_lookup', passed: scoreFromLookup || scorePreview.score_preview === null });

    // 10. 无 consistency_conflict
    verifications.push({ check: 'no_consistency_conflict', passed: !scorePreview.consistency_conflict });

    // ★ 综合判定
    const allPassed = verifications.every(v => v.passed);
    const matchCondition = allPassed ? 'pass'
      : (verifications.filter(v => !v.passed).length <= 2 ? 'uncertain' : 'fail');
    const reasons = verifications.filter(v => !v.passed).map(v => v.check);

    // ★ 写入 fact_rule_matches（每个候选 rule 一条）
    for (const r of rules) {
      const isMatched = (phase2.matched_rule_ids || []).includes(r.id);
      const condition = isMatched ? matchCondition : 'fail';
      const reason = isMatched
        ? (allPassed ? `验证通过: ${verifications.length}项全部通过` : `验证未通过: ${reasons.join(', ')}`)
        : '非候选匹配规则';

      await conn.execute(
        `INSERT INTO fact_rule_matches
         (match_run_id, extracted_fact_id, executable_rule_id, match_condition, confidence, reason, review_status, is_current, preview_data)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', 1, ?)`,
        [matchRunId, extractedFactId, r.id, condition, scorePreview.confidence || phase2.confidence || 0.5, reason, JSON.stringify(previewMeta)]
      );
    }

    // ★ 如果没有匹配到任何 rule，至少记录一条 summary match
    if (rules.length === 0 && candIndicatorId) {
      await conn.execute(
        `INSERT INTO fact_rule_matches
         (match_run_id, extracted_fact_id, executable_rule_id, match_condition, confidence, reason, review_status, is_current)
         VALUES (?, ?, 0, ?, ?, ?, 'pending', 1)`,
        [matchRunId, extractedFactId, matchCondition, phase2.confidence || 0.5,
         allPassed ? '指标已匹配，无具体规则ID' : `验证未通过: ${reasons.join(', ')}`]
      );
    }

    // ★ 完成 run
    await conn.execute(
      "UPDATE rule_match_runs SET status = 'completed', completed_at = NOW() WHERE id = ?",
      [matchRunId]
    );

    await conn.commit();
    log('validateMatch', `run=${matchRunId} fact=${extractedFactId} condition=${matchCondition} rules=${rules.length}`);

    return {
      match_run_id: matchRunId,
      match_condition: matchCondition,
      verifications: verifications.map(v => ({ check: v.check, passed: v.passed })),
      matched_rules: rules.length,
    };
  } catch (e) {
    await conn.rollback();
    if (matchRunId) {
      try { await pool.execute("UPDATE rule_match_runs SET status = 'failed' WHERE id = ?", [matchRunId]); } catch (_) {}
    }
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = {
  buildRuleBlockCards,
  selectRuleBlocksWithKimi,
  loadRuleContext,
  matchFactWithKimi,
  matchFactPipeline,
  validateAndPersistMatch,
};
