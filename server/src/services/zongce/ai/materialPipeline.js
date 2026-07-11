const { pool } = require("../../../config/database");
const { extractFacts } = require("./factExtractor");
const crypto = require("crypto");

function log(step, detail) {
  console.log(`[Material] ${step}`, typeof detail === 'string' ? detail : JSON.stringify(detail).slice(0, 300));
}

// ============================================================
//  阶段 1：提取事实 → 返回可编辑摘要文本
// ============================================================
async function extractMaterialFacts(materialId, userId) {
  log('Phase1:start', `materialId=${materialId} userId=${userId}`);

  // 查材料
  const [mats] = await pool.execute(
    "SELECT * FROM materials WHERE id = ? AND user_id = ?", [materialId, userId]
  );
  if (!mats.length) throw new Error("材料不存在");

  const [attachments] = await pool.execute(
    "SELECT * FROM attachments WHERE material_id = ?", [materialId]
  );
  if (!attachments.length) throw new Error("请先上传证明文件");
  log('Phase1:attachments', `${attachments.length} files: ${attachments.map(a => a.file_name).join(', ')}`);

  // 查规则集
  const [ruleSets] = await pool.execute(
    `SELECT rs.*,
      (SELECT COUNT(*) FROM indicator_nodes WHERE rule_set_id = rs.id) AS indicator_count,
      (SELECT COUNT(*) FROM executable_rules er
       JOIN rule_packages rp ON er.package_id = rp.id
       WHERE rp.rule_set_id = rs.id) AS rule_count
     FROM rule_sets rs
     WHERE rs.user_id = ? AND rs.status = 'published'
     ORDER BY rs.published_at DESC LIMIT 1`, [userId]
  );
  if (!ruleSets.length) throw new Error("请先发布有效规则集");
  const ruleSet = ruleSets[0];
  log('Phase1:ruleSet', `id=${ruleSet.id} indicators=${ruleSet.indicator_count} rules=${ruleSet.rule_count}`);

  if (ruleSet.indicator_count === 0) throw new Error("规则集指标为空");
  if (ruleSet.rule_count === 0) throw new Error("规则集中没有可执行规则");

  // 提取事实
  log('Phase1:extracting', `开始提取 ${attachments.length} 个附件的事实...`);
  const factResult = await extractFacts(attachments);
  log('Phase1:extracted', `提取到 ${factResult.facts.length} 条事实, clarity=${factResult.overall_clarity}`);

  // 更新附件 label
  for (const att of attachments) {
    const factsFromThis = factResult.facts.filter((f) => f.attachment_id === att.id);
    const label = factsFromThis.length > 0
      ? factsFromThis.map((f) => `${f.type}:${f.value}`).slice(0, 3).join("|")
      : "无法提取";
    await pool.execute("UPDATE attachments SET ai_label = ? WHERE id = ?", [label.slice(0, 100), att.id]);
  }

  // 生成可编辑摘要文本
  const summaryLines = [];
  for (const f of factResult.facts) {
    const detailStr = f.detail && Object.keys(f.detail).length > 0
      ? `（${Object.entries(f.detail).map(([k, v]) => `${k}: ${v}`).join("，")}）`
      : "";
    summaryLines.push(`- [${f.type}] ${f.value}${detailStr}（置信度: ${Math.round((f.confidence || 0) * 100)}%）`);
  }
  const summaryText = factResult.facts.length > 0
    ? `从 ${attachments.length} 个附件中识别到以下事实：\n\n${summaryLines.join("\n")}\n\n整体清晰度: ${Math.round((factResult.overall_clarity || 0) * 100)}%`
    : "未能从附件中提取到有效事实，请手动输入。";

  log('Phase1:done', `返回 ${factResult.facts.length} 条事实 + 摘要文本`);

  return {
    material_id: materialId,
    rule_set_id: ruleSet.id,
    facts: factResult.facts,
    summary_text: summaryText,
    overall_clarity: factResult.overall_clarity,
    attachment_count: attachments.length,
    facts_count: factResult.facts.length,
  };
}

// ============================================================
//  PREVIEW ONLY — 分数预览
// ============================================================

/**
 * 维度别名 — 分层管理
 *
 * A 层: 技术格式归一化 (TECH_FORMAT_ALIASES)
 *   AI输出后缀、前端value→DB cell值
 *   例: first_prize→first, school→university
 *
 * B 层: 规则语义别名 (RULE_SEMANTIC_ALIASES)
 *   ★ 必须可追溯到规则原文或管理员配置
 *   ★ 来源: 规则文档表头、行标题、解析后的 alias 配置
 *   ★ TODO: 从数据库规则数据加载，不长期保存在全局常量
 *   例: 一等奖→first, 鼓励奖→encouragement
 *
 * 不在 B 层中的值 → mapped=false → dimension_value_unmapped
 */
const TECH_FORMAT_ALIASES = {
  level: {
    school:'university',       // 前端下拉 school=校级 → DB cell university
  },
  award_type: {
    // identity only
  },
  rank: {
    // Kimi 后缀归一化
    first_prize:'first', second_prize:'second', third_prize:'third',
    special_prize:'special',
  },
};

/** ★ 规则语义别名 — B 层，可追溯到规则原文 */
const RULE_SEMANTIC_ALIASES = {
  level: {
    university:'university', national:'national', provincial:'provincial',
    college:'college', city:'city', community:'community', club:'club',
    '国家级':'national', '省级':'provincial', '校级':'university',
    '院级':'college', '社团级':'club', '地市级':'city', '省（部）级':'provincial',
  },
  award_type: {
    group:'group', individual:'individual',
    '集体':'group', '个人':'individual', '团体':'group',
  },
  rank: {
    first:'first', second:'second', third:'third',
    special:'special', encouragement:'encouragement',
    performance:'performance',
    '一等奖':'first', '二等奖':'second', '三等奖':'third', '特等奖':'special',
    '鼓励奖':'encouragement', '纪念奖':'encouragement', '入围奖':'encouragement',
    '鼓励奖、纪念奖、入围奖':'encouragement',
  },
};

/** 合并别名: TECH 覆盖 RULE（同key时TECH优先） */
const DIMENSION_ALIASES = {};
for (const dim of Object.keys(RULE_SEMANTIC_ALIASES)) {
  DIMENSION_ALIASES[dim] = { ...RULE_SEMANTIC_ALIASES[dim], ...(TECH_FORMAT_ALIASES[dim] || {}) };
}

/**
 * 归一化单个维度值
 * @returns {{ raw: string, normalized: string }} 同时返回原始值和归一化值
 */
/**
 * 加载学院默认奖项认定政策（从 DB 配置，可启用/停用/修改）
 */
let _cachedPolicy = null;
let _policyCacheTime = 0;
async function loadCollegeDefaultPolicy() {
  if (_cachedPolicy && Date.now() - _policyCacheTime < 60000) return _cachedPolicy;
  try {
    const [rows] = await pool.execute(
      "SELECT config_value, enabled FROM zongce_config WHERE config_key = 'college_default_award_policy'"
    );
    if (rows.length && rows[0].enabled) {
      _cachedPolicy = typeof rows[0].config_value === 'string'
        ? JSON.parse(rows[0].config_value) : rows[0].config_value;
    } else {
      _cachedPolicy = null;
    }
    _policyCacheTime = Date.now();
  } catch (_) { _cachedPolicy = null; }
  return _cachedPolicy;
}

/**
 * 维度值归一化（含学院默认政策降级）
 * 优先级: explicit_rule > table_alias > college_default_policy > unmapped
 *
 * @param dimName 维度名称
 * @param value 原始值
 * @param collegePolicy 学院默认政策（从 loadCollegeDefaultPolicy 加载）
 * @returns {{ raw: string, normalized: string|null, mapped: boolean, source: string }}
 *   source: 'table_alias' | 'college_default_policy' | 'unmapped'
 */
function normalizeDimensionValue(dimName, value, collegePolicy = null) {
  const result = { raw: '', normalized: null, mapped: false, source: 'unmapped' };
  if (value == null || value === '') return result;
  const raw = String(value).trim();
  if (!raw) return result;
  result.raw = raw;
  const s = raw.toLowerCase();

  // 查找该维度对应的别名表
  for (const [pattern, map] of Object.entries(DIMENSION_ALIASES)) {
    if (dimName.includes(pattern) || pattern.includes(dimName) || dimName === pattern) {
      const mapped = map[s];
      if (mapped !== undefined) {
        result.normalized = mapped;
        result.mapped = true;
        result.source = 'table_alias';
        return result;
      }
      // 别名表未命中 → 尝试学院默认政策（仅对 rank 维度）
      if (dimName === 'rank' && collegePolicy && collegePolicy.participation_tier_ranks) {
        const isParticipationTier = collegePolicy.participation_tier_ranks.some(
          r => r.toLowerCase() === s || r === raw
        );
        if (isParticipationTier) {
          result.normalized = collegePolicy.maps_to || 'encouragement';
          result.mapped = true;
          result.source = 'college_default_policy';
          return result;
        }
      }
      // 完全无法映射
      return result;
    }
  }
  // 无匹配维度
  result.normalized = raw;
  result.mapped = false;
  return result;
}

async function calculateScorePreview(fact, ruleSetId, pipelineMeta = {}) {
  const debug = { stage: 'start' };
  const explanations = [];
  const missingFields = [];
  const unmappedDimensions = [];
  let score = 0;
  let matchedRule = null;
  let matchedTableId = null;
  let consistencyConflict = false;
  let errorType = null;
  let normalizationSource = null;     // 'table_alias' | 'college_default_policy' | 'unmapped'

  // ★ 加载学院默认政策（缓存60s）
  const collegePolicy = await loadCollegeDefaultPolicy();
  debug.college_policy_enabled = !!collegePolicy;

  try {
    // ---------- 0. 解析 indicator code ----------
    // Kimi 可能返回 "B7.2" 这种子级 code，提取父级 "B7"
    const rawBlock = pipelineMeta.selected_rule_block || fact.suggested_rule_block;
    const parentBlock = rawBlock ? rawBlock.split(/[.\-]/)[0] : null;
    debug.raw_block = rawBlock;
    debug.parent_block = parentBlock;

    if (!parentBlock) {
      errorType = 'indicator_code_missing';
      return { score: 0, score_preview: null, error_type: errorType, explanation: '未提供规则分类', needs_review: true, missing_fields: [], classification_status: 'unmatched', dimension_status: 'incomplete', raw_dimensions: {}, normalized_dimensions: {}, unmapped_dimensions: [], _debug: debug };
    }

    // ---------- 1. 找 indicator ----------
    const [indicators] = await pool.execute(
      "SELECT * FROM indicator_nodes WHERE rule_set_id = ? AND code = ?", [ruleSetId, parentBlock]
    );
    if (!indicators.length) {
      errorType = 'indicator_not_found';
      return { score: 0, score_preview: null, error_type: errorType, explanation: `未找到指标 ${parentBlock}`, needs_review: true, indicator_code: parentBlock, missing_fields: [], classification_status: 'unmatched', dimension_status: 'incomplete', raw_dimensions: {}, normalized_dimensions: {}, unmapped_dimensions: [], _debug: debug };
    }
    const indicator = indicators[0];
    debug.indicator = { id: indicator.id, code: indicator.code, name: indicator.name };

    // ---------- 2. 如果 Kimi 已指定 lookup_table_id，直接使用 ----------
    const kimiTableId = pipelineMeta.matched_lookup_table_id;
    debug.kimi_table_id = kimiTableId;

    if (kimiTableId) {
      // 校验 table 存在且属于当前 rule_set
      const [tables] = await pool.execute(
        "SELECT * FROM lookup_tables WHERE id = ? AND rule_set_id = ?", [kimiTableId, ruleSetId]
      );
      if (tables.length === 0) {
        errorType = 'lookup_table_not_found';
        explanations.push(`Kimi 指定的表 id=${kimiTableId} 不存在或不属于当前规则集`);
      } else {
        const lt = tables[0];
        debug.table = { id: lt.id, name: lt.name, canonical_key: lt.canonical_key };
        matchedTableId = lt.id;

        // 用 Kimi 返回的 score_dimensions 查 cell
        const kimiDims = pipelineMeta.score_dimensions || {};
        debug.raw_dimensions = { ...kimiDims };

        // 加载表的实际维度名
        const [tableDims] = await pool.execute(
          "SELECT dim_name FROM lookup_dimensions WHERE table_id = ? ORDER BY sort_order", [kimiTableId]
        );
        const tableDimNames = tableDims.map(d => d.dim_name);
        debug.table_dim_names = tableDimNames;

        // 维度名映射：Kimi 名称 → DB 实际名称
        const dimNameMap = {};
        unmappedDimensions.length = 0;  // ★ 清空重用于当前表
        for (const [kimiName, value] of Object.entries(kimiDims)) {
          const match = tableDimNames.find(dn =>
            dn === kimiName ||
            dn.includes(kimiName) || kimiName.includes(dn) ||
            (kimiName === 'level' && dn.includes('level')) ||
            (kimiName === 'award_type' && (dn.includes('type') || dn.includes('award'))) ||
            (kimiName === 'rank' && dn.includes('rank'))
          );
          if (match) {
            const nv = normalizeDimensionValue(match, value, collegePolicy);
            dimNameMap[kimiName] = { dbName: match, raw: nv.raw, normalized: nv.normalized, mapped: nv.mapped, source: nv.source };
            if (!nv.mapped && nv.raw) {
              unmappedDimensions.push({ dim_name: match, raw_value: nv.raw });
            } else if (nv.source === 'college_default_policy') {
              normalizationSource = 'college_default_policy';
            }
          }
        }
        debug.dim_name_map = dimNameMap;
        debug.unmapped_dimensions = unmappedDimensions;

        if (Object.keys(dimNameMap).length > 0) {
          const [cells] = await pool.execute(
            "SELECT * FROM lookup_cells WHERE table_id = ?", [kimiTableId]
          );
          debug.candidate_cells_count = cells.length;

          // ★ 辅助：sorted hash（与 DB migration 一致）
          const sortedHash = (dims) => {
            const sorted = {};
            Object.keys(dims).sort().forEach(k => { sorted[k] = dims[k]; });
            return crypto.createHash("sha256").update(JSON.stringify(sorted)).digest("hex").slice(0, 64);
          };

          // ★ 三遍匹配：Raw → Normalized → Fuzzy → Wildcard
          let bestMatch = null;

          // Pass 1: 用原始值（不做归一化）生成 hash 精确匹配
          const rawDims = {};
          for (const [, v] of Object.entries(dimNameMap)) {
            rawDims[v.dbName] = v.raw;
          }
          const rawHash = sortedHash(rawDims);
          debug.dimension_hash_raw = rawHash;
          debug.raw_dimensions = { ...rawDims };
          const rawMatch = cells.find(c => c.dimension_hash === rawHash);
          if (rawMatch) {
            bestMatch = { cell: rawMatch, dims: rawDims, method: 'raw_exact' };
            debug.match_method = 'raw_exact';
          }

          // Pass 2: 用归一化值生成 hash 精确匹配
          if (!bestMatch) {
            const normDims = {};
            for (const [, v] of Object.entries(dimNameMap)) {
              normDims[v.dbName] = v.normalized;
            }
            const normHash = sortedHash(normDims);
            debug.dimension_hash_normalized = normHash;
            debug.normalized_dimensions = { ...normDims };
            const normMatch = cells.find(c => c.dimension_hash === normHash);
            if (normMatch) {
              bestMatch = { cell: normMatch, dims: normDims, method: 'normalized_exact' };
              debug.match_method = 'normalized_exact';
            }
          }

          // Pass 3: Fuzzy 逐 cell 比对（大小写不敏感）
          if (!bestMatch) {
            debug.match_method = 'fuzzy';
            const searchDims = debug.match_method === 'fuzzy' ? rawDims : {};
            // 对 raw 和 normalized 都尝试 fuzzy
            for (const trialDims of [rawDims, (() => {
              const nd = {};
              for (const [, v] of Object.entries(dimNameMap)) nd[v.dbName] = v.normalized;
              return nd;
            })()]) {
              if (bestMatch) break;
              for (const cell of cells) {
                try {
                  const cellDims = typeof cell.dimension_values === 'string'
                    ? JSON.parse(cell.dimension_values) : cell.dimension_values;
                  const allMatch = Object.entries(trialDims).every(([k, v]) =>
                    String(cellDims[k] || '').toLowerCase() === String(v).toLowerCase()
                  );
                  if (allMatch && Object.keys(cellDims).length === Object.keys(trialDims).length) {
                    bestMatch = { cell, dims: trialDims, method: 'fuzzy' };
                    debug.matched_cell = { dims: cellDims, value: cell.value, hash: cell.dimension_hash };
                    break;
                  }
                } catch (_) {}
              }
            }
          }

          // Pass 4: Wildcard 匹配 — DB cell 中明确存 "*" 的维度匹配任意输入值
          //   ★ 仅对 DB 中已有 "*" cell 的维度生效
          //   ★ 其他维度必须精确匹配
          //   ★ 未映射维度不使用 wildcard
          if (!bestMatch) {
            // 找出此表中哪些维度有 wildcard cells
            const wildcardDimNames = new Set();
            for (const cell of cells) {
              try {
                const cd = typeof cell.dimension_values === 'string' ? JSON.parse(cell.dimension_values) : cell.dimension_values;
                for (const [k, v] of Object.entries(cd)) {
                  if (v === '*') wildcardDimNames.add(k);
                }
              } catch (_) {}
            }

            // ★ 使用 normalized dims 作为 wildcard 尝试的基础（非 raw）
            const bestNormDims = (() => { const nd={}; for(const[,v]of Object.entries(dimNameMap))nd[v.dbName]=v.normalized; return nd; })();

            if (wildcardDimNames.size > 0 && unmappedDimensions.length === 0) {
              // 尝试: 将 wildcard-able 维度替换为 "*" 后匹配（用 normalized 值）
              const tryDims = { ...bestNormDims };
              for (const wd of wildcardDimNames) {
                tryDims[wd] = '*';
              }
              const wcHash = sortedHash(tryDims);
              debug.wildcard_dims = { ...tryDims };
              const wcMatch = cells.find(c => c.dimension_hash === wcHash);
              if (wcMatch) {
                bestMatch = { cell: wcMatch, dims: tryDims, method: 'wildcard' };
                debug.match_method = 'wildcard';
              }
            }

            // 也尝试: 仅对 missing dims 做 wildcard
            if (!bestMatch) {
              const missingDims = tableDimNames.filter(dn => !(dn in bestNormDims) && wildcardDimNames.has(dn));
              if (missingDims.length > 0) {
                const wcDims = { ...bestNormDims };
                for (const md of missingDims) wcDims[md] = '*';
                const wcHash = sortedHash(wcDims);
                debug.wildcard_missing_dims = { ...wcDims };
                const wcMatch = cells.find(c => c.dimension_hash === wcHash);
                if (wcMatch) {
                  bestMatch = { cell: wcMatch, dims: wcDims, method: 'wildcard_missing' };
                  debug.match_method = 'wildcard_missing';
                }
              }
            }
          }

          if (bestMatch) {
            score = Number(bestMatch.cell.value) || 0;
            matchedRule = { table_id: lt.id, table_name: lt.name, dimensions: bestMatch.dims, value: bestMatch.cell.value };
            matchedTableId = lt.id;
            explanations.push(`${lt.name}: ${JSON.stringify(bestMatch.dims)} → ${bestMatch.cell.value}分 ✓ (${bestMatch.method})`);
            debug.best_match = bestMatch;
          } else if (unmappedDimensions.length > 0) {
            // ★ 维度值无法通过 alias 映射 → dimension_value_unmapped
            errorType = 'dimension_value_unmapped';
            const udList = unmappedDimensions.map(u => `${u.dim_name}="${u.raw_value}"`).join(', ');
            explanations.push(`维度值无法映射: ${udList}。表支持维度=[${tableDimNames.join(',')}]`);
            debug.unmapped_detail = unmappedDimensions;
          } else {
            // ★ 维度都已映射但组合不存在 → lookup_cell_not_found
            errorType = 'lookup_cell_not_found';
            explanations.push(`${lt.name}: 维度 ${JSON.stringify(rawDims)} 未命中，表实际维度=[${tableDimNames.join(',')}]`);
            debug.failed_dims_raw = rawDims;
          }
        } else {
          errorType = 'dimension_enum_invalid';
          explanations.push(`Kimi 维度 [${Object.keys(kimiDims).join(',')}] 无法映射到表维度 [${tableDimNames.join(',')}]`);
        }

        // 一致性校验：检查 rule 和当前 indicator 是否同属一个分支（允许父子/祖孙关系）
        if (pipelineMeta.matched_rule_ids?.length) {
          const [matchedRules] = await pool.execute(
            `SELECT er.id, er.canonical_key, rp.indicator_id FROM executable_rules er
             JOIN rule_packages rp ON er.package_id = rp.id
             WHERE er.id IN (${pipelineMeta.matched_rule_ids.map(() => '?').join(',')})`,
            pipelineMeta.matched_rule_ids
          );
          const ruleIndicatorIds = [...new Set(matchedRules.map(r => r.indicator_id))];
          debug.matched_rule_indicator_ids = ruleIndicatorIds;

          // 加载祖先链判断是否同分支
          async function getAncestorIds(indId) {
            const ids = [indId];
            let current = indId;
            for (let i = 0; i < 5; i++) {
              const [rows] = await pool.execute(
                "SELECT parent_id FROM indicator_nodes WHERE id = ?", [current]
              );
              if (!rows.length || !rows[0].parent_id) break;
              ids.push(rows[0].parent_id);
              current = rows[0].parent_id;
            }
            return ids;
          }

          const currentAncestors = await getAncestorIds(indicator.id);
          debug.current_ancestor_ids = currentAncestors;

          let isSameBranch = ruleIndicatorIds.some(id => currentAncestors.includes(id));
          if (!isSameBranch) {
            // 也检查 rule indicator 的祖先是否包含当前 indicator
            for (const rid of ruleIndicatorIds) {
              const ruleAncestors = await getAncestorIds(rid);
              if (ruleAncestors.includes(indicator.id)) { isSameBranch = true; break; }
            }
          }

          if (!isSameBranch) {
            consistencyConflict = true;
            errorType = 'lookup_table_relation_mismatch';
            explanations.push(`⚠ 跨分支冲突: rule 属于 indicator [${ruleIndicatorIds.join(',')}] 祖先链=${JSON.stringify(debug.current_ancestor_ids)}，与当前 ${indicator.code}(id=${indicator.id}) 不在同一分支`);
          } else {
            debug.branch_check = 'same_branch';
          }
        }
      }
    }

    // ---------- 3. 如果 Kimi 没有指定表或查表失败，回退到关联筛选 ----------
    if (!matchedRule && !kimiTableId) {
      debug.fallback = true;

      // 策略 A: 从 indicator 的 executable_rules 中找 lookup 类型的 rule
      const [allTables] = await pool.execute("SELECT * FROM lookup_tables WHERE rule_set_id = ?", [ruleSetId]);
      const [lookupRules] = await pool.execute(
        `SELECT er.config, er.canonical_key FROM executable_rules er
         JOIN rule_packages rp ON er.package_id = rp.id
         WHERE rp.indicator_id = ? AND er.rule_type = 'lookup'`, [indicator.id]
      );

      // 收集 candidate table keys: 从 rule config 的 lookup_table_key / lookup_table 字段
      const candidateTableKeys = new Set();
      for (const lr of lookupRules) {
        let cfg = lr.config;
        if (typeof cfg === 'string') cfg = JSON.parse(cfg);
        const ref = cfg.lookup_table_key || cfg.lookup_table || '';
        if (ref) candidateTableKeys.add(ref.toLowerCase());
      }

      // 策略 B: package canonical_key 关键词匹配（保留旧逻辑增强）
      const [packages] = await pool.execute(
        "SELECT * FROM rule_packages WHERE rule_set_id = ? AND indicator_id = ?", [ruleSetId, indicator.id]
      );
      const pkgKeys = packages.map(p => (p.canonical_key || '').toLowerCase());

      const relatedTables = allTables.filter(lt => {
        const lk = (lt.canonical_key || '').toLowerCase();
        const ln = (lt.name || '').toLowerCase();
        // 条件1: rule config 直接引用
        if (candidateTableKeys.has(lk)) return true;
        // 条件2: table key 与 package key 互相包含
        if (pkgKeys.some(k => lk.includes(k) || k.includes(lk))) return true;
        // 条件3: table name 包含 indicator code
        if (ln.includes(parentBlock.toLowerCase())) return true;
        // 条件4: 关键词关联（如 package 含 "competition" 且 table 含 "competition"）
        const pkgWords = pkgKeys.flatMap(k => k.split(/[._-]/));
        const tableWords = lk.split(/[._-]/);
        if (pkgWords.some(w => w.length > 3 && tableWords.some(tw => tw.includes(w) || w.includes(tw)))) return true;
        return false;
      });

      // 如果策略 A+B 都没找到表, 但有 lookupl规则 + 全局表, 尝试所有表
      if (!relatedTables.length && lookupRules.length > 0 && allTables.length > 0) {
        // 尝试所有维度数与 Kimi score_dimensions 匹配的表
        const kimiDimCount = Object.keys(pipelineMeta.score_dimensions || {}).length;
        if (kimiDimCount > 0) {
          for (const lt of allTables) {
            const [dims] = await pool.execute("SELECT COUNT(*) as cnt FROM lookup_dimensions WHERE table_id = ?", [lt.id]);
            if (dims[0].cnt === kimiDimCount) {
              relatedTables.push(lt);
            }
          }
        }
        // 如果仍然没有, 且只有唯一表, 但有歧义风险
        if (!relatedTables.length && allTables.length === 1) {
          // 单表情况: 不自动选取, 提示歧义
        }
      }

      if (relatedTables.length > 1) {
        // ★ 多张候选表 → 不自动选，返回歧义
        errorType = 'ambiguous_lookup_table';
        const candidates = relatedTables.map(lt => ({ id: lt.id, name: lt.name, canonical_key: lt.canonical_key }));
        explanations.push(`指标 ${parentBlock} 匹配到 ${candidates.length} 张候选查分表: ${candidates.map(c => c.name).join(', ')}`);
        debug.ambiguous_tables = candidates;
      } else if (relatedTables.length === 1) {
        const lt = relatedTables[0];
        debug.fallback_table = { id: lt.id, name: lt.name };
        const [dims] = await pool.execute("SELECT * FROM lookup_dimensions WHERE table_id = ?", [lt.id]);
        const dimValues = {};
        for (const d of dims) {
          const v = pipelineMeta.score_dimensions?.[d.dim_name]
            || (d.dim_name.includes('level') ? fact.inferred_level
            : d.dim_name.includes('rank') ? fact.award_rank
            : d.dim_name.includes('type') ? 'award' : null);
          if (v) {
            const nv = normalizeDimensionValue(d.dim_name, v, collegePolicy);
            dimValues[d.dim_name] = nv.raw;
          }
        }
        if (Object.keys(dimValues).length > 0) {
          const hash = (()=>{const s={};Object.keys(dimValues).sort().forEach(k=>s[k]=dimValues[k]);return crypto.createHash('sha256').update(JSON.stringify(s)).digest('hex').slice(0,64);})();
          const [cells] = await pool.execute("SELECT * FROM lookup_cells WHERE table_id = ? AND dimension_hash = ?", [lt.id, hash]);
          if (cells.length > 0) {
            score = Number(cells[0].value) || 0;
            matchedRule = { table_id: lt.id, table_name: lt.name, dimensions: dimValues, value: cells[0].value };
            matchedTableId = lt.id;
            explanations.push(`${lt.name}: ${JSON.stringify(dimValues)} → ${cells[0].value}分 (回退匹配)`);
          } else {
            // Fallback fuzzy
            const [allCells] = await pool.execute("SELECT * FROM lookup_cells WHERE table_id = ?", [lt.id]);
            for (const cell of allCells) {
              try {
                const cellDims = typeof cell.dimension_values === 'string' ? JSON.parse(cell.dimension_values) : cell.dimension_values;
                const allMatch = Object.entries(dimValues).every(([k, v]) =>
                  String(cellDims[k] || '').toLowerCase() === String(v || '').toLowerCase()
                );
                if (allMatch) {
                  score = Number(cell.value) || 0;
                  matchedRule = { table_id: lt.id, table_name: lt.name, dimensions: dimValues, value: cell.value };
                  matchedTableId = lt.id;
                  explanations.push(`${lt.name}: ${JSON.stringify(dimValues)} → ${cell.value}分 (回退fuzzy)`);
                  break;
                }
              } catch (_) {}
            }
          }
        }
        if (!matchedRule && !errorType) {
          errorType = 'lookup_cell_not_found';
          explanations.push(`回退表 ${lt.name}: 无法匹配维度值`);
        }
      }
    }

    // ---------- 4. 回退：Kimi 指定了表但查表失败 → 尝试关联表 ----------
    if (!matchedRule && kimiTableId && !errorType) {
      // Kimi 指定的表没有匹配到 cell，尝试用 fallback 逻辑再找
      debug.kimi_table_failed_fallback = true;
      // (上面已经尝试过 kimiTableId 的精确+fuzzy匹配, 这里直接报错)
    }

    // ---------- 5. 最终兜底 ----------
    if (!matchedRule && !errorType) {
      errorType = kimiTableId ? 'lookup_cell_not_found' : 'lookup_table_not_associated';
      explanations.push(errorType === 'lookup_cell_not_found'
        ? `表 id=${kimiTableId} 中未找到匹配的 lookup cell`
        : `指标 ${parentBlock} 没有关联的查分表`);
    }

    // ★ 检查必要字段是否缺失
    if (!fact.inferred_level && !pipelineMeta.score_dimensions?.level) missingFields.push('level');
    if (!fact.award_rank && !pipelineMeta.score_dimensions?.rank) missingFields.push('rank');

  } catch (e) {
    errorType = 'internal_error';
    explanations.push(`算分异常: ${e.message}`);
    console.error('[calcScore]', e.message);
  }

  // ★ score=0 是合法分值，用 null 表示计算失败
  const scorePreview = (!matchedRule && !errorType) ? null
    : (matchedRule ? score : null);

  // ★ 维度状态
  const dimensionStatus = (unmappedDimensions.length > 0) ? 'unmapped'
    : (errorType === 'lookup_cell_not_found') ? 'cell_not_found'
    : (matchedRule) ? 'complete'
    : (missingFields.length > 0) ? 'incomplete'
    : 'complete';

  return {
    score: score,
    score_preview: scorePreview,
    matched_rule: matchedRule,
    matched_table_id: matchedTableId,
    indicator_code: debug.parent_block || fact.suggested_rule_block,
    indicator_name: debug.indicator?.name || '',
    indicator_id: debug.indicator?.id || null,
    explanation: explanations.join('; ') || '未匹配到查分表',
    classification_status: debug.indicator ? 'matched' : 'unmatched',
    dimension_status: dimensionStatus,
    normalization_source: normalizationSource || (unmappedDimensions.length > 0 ? 'unmapped' : 'table_alias'),
    raw_dimensions: debug.raw_dimensions || {},
    normalized_dimensions: debug.normalized_dimensions || debug.raw_dimensions || {},
    unmapped_dimensions: unmappedDimensions.map(u => ({ dim_name: u.dim_name, raw_value: u.raw_value })),
    error_type: errorType || null,
    missing_fields: missingFields,
    needs_review: scorePreview === null || consistencyConflict || !!errorType,
    consistency_conflict: consistencyConflict,
    _debug: debug,
  };
}

module.exports = { extractMaterialFacts, calculateScorePreview };
