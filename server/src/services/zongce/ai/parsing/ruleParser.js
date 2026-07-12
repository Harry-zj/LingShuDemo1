const { pool } = require("../../../../config/database");
const { chatStreamJson } = require("../deepseek");
const { V2_RULE_PARSE_SYSTEM } = require("../prompts");
const { validateV2RuleParse } = require("../schemas");
const { extractStructure, buildChapterTree, buildParseTasks } = require("./docStructure");
const path = require("path");
const crypto = require("crypto");

// ============================================================
//  Task 拆分 —— 章节识别后，对超阈值的 task 按业务块/表格语义单元细分
// ============================================================

/** 超过此阈值（字符数）必须拆分 */
const TASK_CHAR_THRESHOLD = 2000;

/** 表格密度阈值：表格数 > 此值 且总字符 > 1200 时也强制拆分 */
const TABLE_DENSE_THRESHOLD = 3;

/** 业务块编号：B1–B8、C1 等 */
const BUSINESS_BLOCK_RE = /^[A-H]\d/;

/**
 * 在 task 的 block 范围内发现业务块边界
 * 返回 [{ title, startIdx, endIdx, isBusinessBlock }]
 */
function detectBusinessBlocks(taskBlocks) {
  if (!taskBlocks.length) return [];

  const segments = [];
  let segStart = taskBlocks[0].order_index;
  let segTitle = null;

  for (let i = 0; i < taskBlocks.length; i++) {
    const b = taskBlocks[i];
    const text = (b.title || b.content || "").trim();

    const isBiz =
      (b.block_type === "heading" || b.block_type === "paragraph") &&
      BUSINESS_BLOCK_RE.test(text) &&
      text.length < 60;

    if (isBiz) {
      if (i > 0) {
        segments.push({ title: segTitle, startIdx: segStart, endIdx: taskBlocks[i - 1].order_index, isBusinessBlock: !!segTitle });
      }
      segStart = b.order_index;
      segTitle = text;
    }
  }

  // 最后一个
  segments.push({ title: segTitle, startIdx: segStart, endIdx: taskBlocks[taskBlocks.length - 1].order_index, isBusinessBlock: !!segTitle });

  return segments;
}

/**
 * 在 segment 内按"表格标题 + 表格 + 表后注释"语义单元再拆分
 * 绝不生成孤立表标题/注/说明的碎片
 */
function splitByTableUnits(taskBlocks, segStartIdx, segEndIdx) {
  const segBlocks = taskBlocks.filter(b => b.order_index >= segStartIdx && b.order_index <= segEndIdx);
  if (!segBlocks.length) return [];

  const units = [];
  let unitStart = segStartIdx;
  let tbl = 0, note = 0, chars = 0;

  for (let i = 0; i < segBlocks.length; i++) {
    const b = segBlocks[i];
    const text = b.content || "";
    chars += text.length;
    if (b.block_type === "table") tbl++;
    if (b.block_type === "paragraph" && /^(注[：:]|说明[：:])/.test(text.trim())) note++;

    // 下一个 block 是表格标题 → 切分点
    const next = segBlocks[i + 1];
    const isNextTableTitle =
      next &&
      next.block_type !== "table" &&
      /^(表\d|附表|[A-H]\d)/.test((next.title || next.content || "").trim()) &&
      (next.title || next.content || "").trim().length < 40;

    if (isNextTableTitle && chars > 800) {
      units.push({ startIdx: unitStart, endIdx: b.order_index, tableCount: tbl, noteCount: note, charCount: chars });
      unitStart = next.order_index;
      tbl = 0; note = 0; chars = 0;
    }
  }

  units.push({ startIdx: unitStart, endIdx: segBlocks[segBlocks.length - 1].order_index, tableCount: tbl, noteCount: note, charCount: chars });

  // 合并过小碎片
  const merged = [];
  for (const u of units) {
    if (u.charCount < 300 && merged.length > 0) {
      const prev = merged[merged.length - 1];
      prev.endIdx = u.endIdx;
      prev.tableCount += u.tableCount;
      prev.noteCount += u.noteCount;
      prev.charCount += u.charCount;
    } else {
      merged.push(u);
    }
  }
  return merged;
}

/**
 * 主入口：对 buildParseTasks 产出的任务做大任务拆分
 */
function splitLargeTasks(blocks, parseTasks) {
  const refined = [];

  for (let ti = 0; ti < parseTasks.length; ti++) {
    const task = parseTasks[ti];
    const taskBlocks = blocks.filter(b => b.order_index >= task.block_start && b.order_index <= task.block_end);
    const totalChars = taskBlocks.reduce((s, b) => s + (b.content || "").length, 0);

    const tableCount = taskBlocks.filter(b => b.block_type === 'table').length;

    if (totalChars <= TASK_CHAR_THRESHOLD && tableCount <= TABLE_DENSE_THRESHOLD) {
      refined.push({ ...task, char_count: totalChars, is_sub_task: false, included_table_count: tableCount });
      continue;
    }

    // --- 需要拆分 ---
    const segments = detectBusinessBlocks(taskBlocks);

    if (segments.length <= 1) {
      // 无业务块边界 → 按表格单元切
      const units = splitByTableUnits(taskBlocks, task.block_start, task.block_end);
      for (const u of units) {
        refined.push({
          chapter_id: task.chapter_id, chapter_title: task.chapter_title,
          section_id: task.section_id, section_title: task.section_title,
          block_start: u.startIdx, block_end: u.endIdx,
          is_sub_task: true, parent_task_index: ti,
          business_block_title: task.section_title || task.chapter_title,
          included_table_count: u.tableCount, included_note_count: u.noteCount, char_count: u.charCount,
        });
      }
      console.log(`[V2Parse] 任务${ti + 1} (${totalChars}字) → ${units.length}个表格单元子任务`);
      continue;
    }

    // 有业务块 → 按业务块拆
    let subCount = 0;
    for (const seg of segments) {
      const segChars = taskBlocks.filter(b => b.order_index >= seg.startIdx && b.order_index <= seg.endIdx).reduce((s, b) => s + (b.content || "").length, 0);

      if (segChars > TASK_CHAR_THRESHOLD) {
        const units = splitByTableUnits(taskBlocks, seg.startIdx, seg.endIdx);
        for (const u of units) {
          refined.push({
            chapter_id: task.chapter_id, chapter_title: task.chapter_title,
            section_id: task.section_id, section_title: task.section_title,
            block_start: u.startIdx, block_end: u.endIdx,
            is_sub_task: true, parent_task_index: ti,
            business_block_title: seg.title || (task.section_title || task.chapter_title),
            included_table_count: u.tableCount, included_note_count: u.noteCount, char_count: u.charCount,
          });
          subCount++;
        }
      } else {
        refined.push({
          chapter_id: task.chapter_id, chapter_title: task.chapter_title,
          section_id: task.section_id, section_title: task.section_title,
          block_start: seg.startIdx, block_end: seg.endIdx,
          is_sub_task: true, parent_task_index: ti,
          business_block_title: seg.title || (task.section_title || task.chapter_title),
          included_table_count: 0, included_note_count: 0, char_count: segChars,
        });
        subCount++;
      }
    }
    console.log(`[V2Parse] 任务${ti + 1} (${totalChars}字) → ${subCount}个子任务（按业务块）`);
  }

  // 警告仍偏大的子任务
  for (const t of refined) {
    if (t.char_count > TASK_CHAR_THRESHOLD * 1.5) {
      console.warn(`[V2Parse] ⚠ 子任务仍偏大: "${t.business_block_title || t.chapter_title}" ${t.char_count}字 [${t.block_start}-${t.block_end}]`);
    }
  }

  return refined;
}

// ============================================================
//  合并 & 去重
// ============================================================

function normKey(key) {
  if (!key) return "";
  return key.toLowerCase().replace(/[\s　]+/g, " ").trim();
}

function buildIndicatorKey(ind) {
  return normKey(ind.canonical_key || ind.code || "");
}

function buildPackageKey(pkg) {
  return normKey(pkg.canonical_key || "");
}

function buildRuleKey(rule, pkgKey) {
  return normKey((pkgKey || "") + "::" + (rule.canonical_key || ""));
}

/** 单 task 内去重 */
function dedupPerTask(result) {
  if (!result) return result;

  const seenInd = new Set();
  const cleanIndicators = [];
  for (const ind of (result.indicators || [])) {
    const key = buildIndicatorKey(ind);
    if (key && seenInd.has(key)) continue;
    if (key) seenInd.add(key);
    if (ind.children) {
      const seenChild = new Set();
      ind.children = ind.children.filter(c => { const ck = buildIndicatorKey(c); if (ck && seenChild.has(ck)) return false; if (ck) seenChild.add(ck); return true; });
    }
    cleanIndicators.push(ind);
  }

  const seenPkg = new Set();
  const cleanPackages = [];
  for (const pkg of (result.packages || [])) {
    const key = buildPackageKey(pkg);
    if (key && seenPkg.has(key)) continue;
    if (key) seenPkg.add(key);
    const seenRule = new Set();
    pkg.rules = (pkg.rules || []).filter(r => { const rk = buildRuleKey(r, pkg.canonical_key); if (rk && seenRule.has(rk)) return false; if (rk) seenRule.add(rk); return true; });
    cleanPackages.push(pkg);
  }

  return { ...result, indicators: cleanIndicators, packages: cleanPackages };
}

/** 递归合并两个 indicator 节点（修改 base） */
function mergeIndicatorNode(base, other) {
  if (!other.children || !other.children.length) return base;
  if (!base.children) base.children = [];
  const map = new Map();
  for (const c of base.children) map.set(buildIndicatorKey(c), c);
  for (const oc of other.children) {
    const key = buildIndicatorKey(oc);
    if (!key) continue;
    if (map.has(key)) { mergeIndicatorNode(map.get(key), oc); }
    else { base.children.push({ ...oc }); map.set(key, base.children[base.children.length - 1]); }
  }
  return base;
}

/**
 * 跨 task 合并去重
 * 返回 { merged, sourceRefs, duplicates }
 */
function mergeAndDedupResults(allResults, allTasks) {
  const sourceRefs = [];
  const duplicates = [];
  const merged = { indicators: [], packages: [], lookup_tables: [], uncertainties: [] };

  // ---- indicators（递归树合并）----
  const indicatorMap = new Map();
  for (let ti = 0; ti < allResults.length; ti++) {
    const r = allResults[ti]; if (!r) continue;
    const task = allTasks[ti];
    const label = task ? (task.business_block_title || task.section_title || task.chapter_title || `T${ti + 1}`) : `T${ti + 1}`;
    for (const ind of (r.indicators || [])) {
      const key = buildIndicatorKey(ind); if (!key) continue;
      sourceRefs.push({ entityType: 'indicator', canonicalKey: key, taskIndex: ti, taskLabel: label });
      if (indicatorMap.has(key)) {
        indicatorMap.get(key).taskIndices.push(ti);
        mergeIndicatorNode(indicatorMap.get(key).node, ind);
      } else {
        indicatorMap.set(key, { node: { ...ind }, taskIndices: [ti] });
      }
    }
  }
  for (const [key, v] of indicatorMap) { if (v.taskIndices.length > 1) duplicates.push({ entityType: 'indicator', canonicalKey: key, taskIndices: v.taskIndices }); }
  // 只保留非子节点的顶级 indicator
  for (const [, v] of indicatorMap) {
    let isChild = false;
    for (const [, p] of indicatorMap) {
      if (p.node.children && p.node.children.some(c => buildIndicatorKey(c) === buildIndicatorKey(v.node))) { isChild = true; break; }
    }
    if (!isChild) merged.indicators.push(v.node);
  }

  // ---- packages ----
  const pkgMap = new Map();
  for (let ti = 0; ti < allResults.length; ti++) {
    const r = allResults[ti]; if (!r) continue;
    const task = allTasks[ti];
    const label = task ? (task.business_block_title || task.section_title || task.chapter_title || `T${ti + 1}`) : `T${ti + 1}`;
    for (const pkg of (r.packages || [])) {
      const key = buildPackageKey(pkg); if (!key) continue;
      sourceRefs.push({ entityType: 'package', canonicalKey: key, taskIndex: ti, taskLabel: label });
      if (pkgMap.has(key)) {
        pkgMap.get(key).taskIndices.push(ti);
        const existMap = new Map();
        for (const rl of (pkgMap.get(key).pkg.rules || [])) existMap.set(buildRuleKey(rl, key), rl);
        for (const rl of (pkg.rules || [])) {
          const rk = buildRuleKey(rl, key);
          if (!existMap.has(rk)) { pkgMap.get(key).pkg.rules.push(rl); existMap.set(rk, rl); }
          else if (Object.keys(rl.config || {}).length > Object.keys(existMap.get(rk).config || {}).length) { Object.assign(existMap.get(rk), rl); }
        }
      } else {
        pkgMap.set(key, { pkg: { ...pkg, rules: [...(pkg.rules || [])] }, taskIndices: [ti] });
      }
    }
  }
  for (const [key, v] of pkgMap) { if (v.taskIndices.length > 1) duplicates.push({ entityType: 'package', canonicalKey: key, taskIndices: v.taskIndices }); }
  merged.packages = Array.from(pkgMap.values()).map(v => v.pkg);

  // ---- lookup_tables & uncertainties ----
  const seenLT = new Set();
  for (const r of allResults) {
    if (!r) continue;
    for (const lt of (r.lookup_tables || [])) { const k = normKey(lt.canonical_key || lt.name || ""); if (k && !seenLT.has(k)) { seenLT.add(k); merged.lookup_tables.push(lt); } }
    if (r.uncertainties) merged.uncertainties.push(...r.uncertainties);
  }

  return { merged, sourceRefs, duplicates };
}

// ============================================================
//  Indicator 别名解析器
//  ============================================================

/**
 * 建立 indicator 的多路别名映射：
 *   code          → { canonical_key }
 *   canonical_key → { code, name }
 *   norm(name)    → { canonical_key, code }
 * 解决 AI 在不同 task 中用了 code 引用、canonical_key 引用、或名称引用不一致的问题。
 */
function buildIndicatorAliasMap(indicators) {
  const byCode = new Map();       // code → { ckey, name }
  const byCKey = new Map();       // canonical_key → { code, name }
  const byName = new Map();       // norm(name) → { ckey, code }

  function walk(nodes) {
    for (const n of nodes) {
      const ck = normKey(n.canonical_key);
      if (ck) byCKey.set(ck, { code: n.code || '', name: n.name || '', node: n });
      if (n.code) byCode.set(n.code, { ckey: ck || n.canonical_key || '', name: n.name || '', node: n });
      const nm = normKey(n.name);
      if (nm) byName.set(nm, { ckey: ck || n.canonical_key || '', code: n.code || '', node: n });
      if (n.children) walk(n.children);
    }
  }
  walk(indicators);
  return { byCode, byCKey, byName };
}

/** 用别名映射解析 indicator_code 引用 → 返回匹配的 canonical_key，或 null */
function resolveIndicator(aliasMap, ref) {
  if (!ref) return null;
  // 1. 精确 code 匹配
  if (aliasMap.byCode.has(ref)) return aliasMap.byCode.get(ref).ckey;
  // 2. canonical_key 直接匹配
  const nk = normKey(ref);
  if (aliasMap.byCKey.has(nk)) return nk;
  // 3. 规范化名称匹配
  if (aliasMap.byName.has(nk)) return aliasMap.byName.get(nk).ckey;
  // 4. 宽松匹配：遍历 code map，忽略大小写
  for (const [code, v] of aliasMap.byCode) {
    if (code.toLowerCase() === ref.toLowerCase()) return v.ckey;
  }
  return null;
}

// ============================================================
//  合并后二次硬校验（含别名解析）
// ============================================================
function validateMergedResult(merged) {
  const errors = [];
  const warnings = [];
  const allIndKeys = new Set();
  const allIndCodes = new Set();

  // 构建别名映射
  const aliasMap = buildIndicatorAliasMap(merged.indicators);

  function collect(nodes, path) {
    for (const n of nodes) {
      const k = normKey(n.canonical_key);
      if (!k) { errors.push(`indicator 缺 canonical_key @ ${path}`); continue; }
      if (allIndKeys.has(k)) errors.push(`合并后重复 indicator canonical_key: "${k}"`);
      allIndKeys.add(k);
      if (n.code) allIndCodes.add(n.code);
      if (n.children) collect(n.children, `${path}/${k}`);
    }
  }
  collect(merged.indicators, 'root');

  // parent 引用校验（用别名解析）
  function checkParents(nodes) {
    for (const n of nodes) {
      if (n.parent_code) {
        const resolved = resolveIndicator(aliasMap, n.parent_code);
        if (!resolved)
          errors.push(`indicator "${n.canonical_key}" parent "${n.parent_code}" 引用不存在（已尝试 code/ckey/name 解析）`);
      }
      if (n.children) checkParents(n.children);
    }
  }
  checkParents(merged.indicators);

  // package / rule 校验
  const allPkgKeys = new Set();
  for (const pkg of (merged.packages || [])) {
    const k = normKey(pkg.canonical_key);
    if (!k) { errors.push('package 缺 canonical_key'); continue; }
    if (allPkgKeys.has(k)) errors.push(`合并后重复 package canonical_key: "${k}"`);
    allPkgKeys.add(k);

    // indicator_code 引用校验（用别名解析）
    if (pkg.indicator_code) {
      const resolved = resolveIndicator(aliasMap, pkg.indicator_code);
      if (!resolved) {
        // 打印别名映射辅助排查
        console.warn(`[V2Parse] 别名映射 code 列表: ${[...aliasMap.byCode.keys()].join(', ')}`);
        console.warn(`[V2Parse] 别名映射 ckey 列表: ${[...aliasMap.byCKey.keys()].slice(0, 20).join(', ')}...`);
        errors.push(`package "${k}" indicator_code "${pkg.indicator_code}" 不存在（code/ckey/name 均未匹配）`);
      }
    }

    const ruleKeys = new Set();
    for (const r of (pkg.rules || [])) {
      const rk = normKey(r.canonical_key);
      if (!rk) errors.push(`rule in "${k}" 缺 canonical_key`);
      else if (ruleKeys.has(rk)) errors.push(`package "${k}" 内重复 rule "${rk}"`);
      if (rk) ruleKeys.add(rk);
    }
  }

  if (warnings.length > 0) console.warn(`[V2Parse] 硬校验警告:\n  ${warnings.join('\n  ')}`);

  return { ok: errors.length === 0, errors, warnings, aliasMap };
}

// ============================================================
//  V2 规则解析
// ============================================================
async function parseRuleSourceV2(sourceId, userId, onProgress) {
  const [sources] = await pool.execute("SELECT * FROM rule_sources WHERE id = ?", [sourceId]);
  if (!sources.length) throw new Error("规则来源不存在");
  const source = sources[0];
  if (source.source_type !== "file" || !source.file_path) throw new Error("V2 仅支持文件解析");

  const filePath = path.join(__dirname, "../../../../../uploads", source.file_path);
  const ext = path.extname(source.file_name).toLowerCase();

  // ===== 1. 提取文档结构 =====
  let blocks, inputHash;
  if (ext === ".docx") {
    const result = await extractStructure(filePath);
    blocks = result.blocks; inputHash = result.inputHash;
  } else {
    const text = await extractText(filePath, source.file_name);
    blocks = [{ block_type: "paragraph", content: text, order_index: 0, title: "", source_location: "", style_info: {}, numbering_info: null, structured_content: null, structure_confidence: 0.5 }];
  }
  if (!blocks.length) throw new Error("文档无内容");

  if (onProgress) await onProgress('extracting', { blocks: blocks.length, headings: blocks.filter(b=>b.block_type==='heading').length });

  // ===== 2. 创建 rule_set + 写 doc_blocks =====
  const [rs] = await pool.execute("INSERT INTO rule_sets (user_id, version_label, status) VALUES (?, ?, 'draft')", [userId, source.file_name || '规则集']);
  const ruleSetId = rs.insertId;
  await pool.execute("INSERT INTO rule_set_documents (rule_set_id, rule_source_id, document_role) VALUES (?, ?, 'primary')", [ruleSetId, sourceId]);
  const [parseRun] = await pool.execute(
    "INSERT INTO document_parse_runs (rule_source_id, parser_version, model_name, prompt_version, input_hash, status) VALUES (?, 'v2', 'mammoth', 'v1', ?, 'running')",
    [sourceId, inputHash || '']
  );
  const parseRunId = parseRun.insertId;
  for (const b of blocks) {
    await pool.execute(
      "INSERT INTO doc_blocks (rule_source_id, parse_run_id, block_type, title, content, structured_content, source_location, order_index) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [sourceId, parseRunId, b.block_type, b.title || '', b.content || '', b.structured_content ? JSON.stringify(b.structured_content) : null, b.source_location || '', b.order_index]
    );
  }

  // ===== 3. 章节识别 + 初始解析任务 =====
  const chapters = buildChapterTree(blocks);
  let parseTasks = buildParseTasks(blocks, chapters);
  console.log(`[V2Parse] ${blocks.length} blocks → ${chapters.length}章, ${parseTasks.length}个初始任务`);
  if (onProgress) await onProgress('chapter_tree', { chapters: chapters.length, tasks: parseTasks.length, chapter_titles: chapters.map(c => c.title) });

  if (chapters.length === 0) {
    const errMsg = "检测到 heading blocks，但未识别出顶层章节，请检查章节识别规则";
    console.error(`[V2Parse] ${errMsg}`);
    await pool.execute("UPDATE document_parse_runs SET status = 'failed', raw_ai_response = ? WHERE id = ?", [errMsg, parseRunId]);
    await pool.execute("UPDATE rule_sets SET status = 'draft' WHERE id = ?", [ruleSetId]);
    throw new Error(errMsg);
  }

  // ===== 3.6 大任务智能拆分 =====
  parseTasks = splitLargeTasks(blocks, parseTasks);
  console.log(`[V2Parse] 拆分后共 ${parseTasks.length} 个任务`);
  if (onProgress) await onProgress('task_split', { total: parseTasks.length, chapters: chapters.length });

  // ===== 4. 并行执行所有任务 =====
  const parallelLimit = 6;
  const allResults = new Array(parseTasks.length).fill(null);
  const taskFailures = [];
  let completedCount = 0, failedCount = 0;

  for (let i = 0; i < parseTasks.length; i += parallelLimit) {
    const batch = parseTasks.slice(i, i + parallelLimit);
    const batchResults = await Promise.all(batch.map(async (task, j) => {
      const globalIdx = i + j;
      const taskBlocks = blocks.filter(b => b.order_index >= task.block_start && b.order_index <= task.block_end);
      const taskText = taskBlocks.map(b => b.content).join("\n\n");
      const label = task.business_block_title
        ? `${task.chapter_title} > ${task.business_block_title}`
        : task.section_title ? `${task.chapter_title} > ${task.section_title}` : task.chapter_title;

      // 最多重试 2 次（应对 DeepSeek API "terminated" 等瞬时错误）
      let lastError = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await chatStreamJson(
            [{ role: "system", content: V2_RULE_PARSE_SYSTEM }, { role: "user", content: `=== ${label} ===\n${taskText}` }],
            { temperature: 0.1, maxTokens: 8192 }
          );
          if (attempt > 0) console.log(`[V2Parse] 任务${globalIdx + 1} 重试成功`);
          completedCount++;
          return { taskIndex: globalIdx, label, result: dedupPerTask(result), ok: true };
        } catch (e) {
          lastError = e;
          if (attempt === 0 && (e.message.includes('terminated') || e.message.includes('ETIMEDOUT') || e.message.includes('ECONNRESET'))) {
            console.warn(`[V2Parse] 任务${globalIdx + 1} "${label}" ${e.message.slice(0,60)}，1秒后重试...`);
            await new Promise(r => setTimeout(r, 1000));
            continue;
          }
          break; // 非瞬时错误不重试
        }
      }
      failedCount++;
      taskFailures.push({ taskIndex: globalIdx, label, error: lastError.message, charCount: taskText.length, isTruncation: lastError.message.includes('JSON解析失败') || lastError.message.includes('格式异常') });
      console.warn(`[V2Parse] 任务${globalIdx + 1} "${label}" 失败: ${lastError.message.slice(0, 120)}`);
      return { taskIndex: globalIdx, label, result: null, ok: false, error: lastError.message };
    }));
    for (const r of batchResults) allResults[r.taskIndex] = r.result;

    // 每批完成后上报进度
    if (onProgress) {
      await onProgress('executing', {
        completed: completedCount + failedCount,
        total: parseTasks.length,
        success: completedCount,
        failed: failedCount,
      });
    }
  }

  console.log(`[V2Parse] 执行完成: ${completedCount}/${parseTasks.length} 成功, ${failedCount} 失败`);

  if (taskFailures.length > 0) {
    console.log(`[V2Parse] ========== 失败任务清单 ==========`);
    for (const f of taskFailures) console.log(`  [T${f.taskIndex + 1}] ${f.label} → ${f.error.slice(0, 150)} (${f.charCount}字, 截断:${f.isTruncation})`);
  }

  if (failedCount === parseTasks.length) {
    const errMsg = `所有 ${parseTasks.length} 个解析任务均失败`;
    await pool.execute("UPDATE document_parse_runs SET status = 'failed', raw_ai_response = ? WHERE id = ?", [JSON.stringify({ error: errMsg, failures: taskFailures }), parseRunId]);
    await pool.execute("UPDATE rule_sets SET status = 'draft' WHERE id = ?", [ruleSetId]);
    throw new Error(errMsg);
  }

  // ===== 4.5 调试：打印每个 task 的 indicators 摘要 =====
  console.log('[V2Parse] ========== 各任务 indicators 摘要 ==========');
  for (let ti = 0; ti < allResults.length; ti++) {
    const r = allResults[ti];
    if (!r) { console.log(`  [T${ti + 1}] (失败)`); continue; }
    const task = parseTasks[ti];
    const label = task ? (task.business_block_title || task.section_title || task.chapter_title || `T${ti + 1}`) : `T${ti + 1}`;
    console.log(`  [T${ti + 1}] ${label} (${(r.indicators || []).length} indicators):`);
    const printNodes = (nodes, depth) => {
      for (const n of (nodes || [])) {
        console.log(`    ${'  '.repeat(depth)}code=${n.code || '-'} name="${(n.name || '').slice(0,40)}" ckey=${n.canonical_key || '-'} parent=${n.parent_code || '-'} calc=${n.calc_method || '-'}`);
        if (n.children) printNodes(n.children, depth + 1);
      }
    };
    printNodes(r.indicators, 0);
  }
  console.log('[V2Parse] ==========================================');

  // ===== 5. 合并去重 =====
  if (onProgress) await onProgress('merging', { results: allResults.filter(r => r !== null).length, total: parseTasks.length });
  const validResults = allResults.filter(r => r !== null);
  const validTasks = parseTasks.filter((_, i) => allResults[i] !== null);
  const { merged: allResult, sourceRefs, duplicates } = mergeAndDedupResults(validResults, validTasks);

  if (duplicates.length > 0) {
    console.log(`[V2Parse] 跨任务去重合并: ${duplicates.length} 项`);
    for (const d of duplicates) console.log(`  ${d.entityType} "${d.canonicalKey}" ← 任务 ${d.taskIndices.join(', ')}`);
  }

  // ===== 6. 清洗 =====
  // 清洗 indicators 的 calc_method
  const cleanCalcMethod = (nodes) => {
    for (const n of (nodes || [])) {
      n.calc_method = sanitizeCalcMethod(n.calc_method);
      if (n.children) cleanCalcMethod(n.children);
    }
  };
  cleanCalcMethod(allResult.indicators);

  for (const pkg of (allResult.packages || [])) {
    pkg.auto_level = sanitizeAutoLevel(pkg.auto_level);
    for (const rule of (pkg.rules || [])) {
      rule.auto_level = sanitizeAutoLevel(rule.auto_level);
      if (!rule.application_scope || !['per_fact','per_material','per_group','per_indicator','global'].includes(rule.application_scope)) rule.application_scope = 'per_fact';
      if (rule.rule_type === 'reference') rule.rule_type = 'lookup';
      if (rule.rule_type === 'sum') rule.rule_type = 'fixed';
    }
  }

  // ===== 7. 校验（schema + 二次硬校验）=====
  if (onProgress) await onProgress('validating', { indicators: (allResult.indicators || []).length, packages: (allResult.packages || []).length });
  const valid = validateV2RuleParse(allResult);
  if (!valid.ok) {
    const errMsg = "V2解析校验失败: " + valid.error;
    console.error(`[V2Parse] ${errMsg}`);
    await pool.execute("UPDATE document_parse_runs SET status = 'failed', raw_ai_response = ? WHERE id = ?", [JSON.stringify({ error: errMsg, validationErrors: valid.error, taskFailures }), parseRunId]);
    await pool.execute("UPDATE rule_sets SET status = 'draft' WHERE id = ?", [ruleSetId]);
    await pool.execute("UPDATE rule_sources SET status = 'pending' WHERE id = ?", [sourceId]);
    throw new Error(errMsg);
  }

  const hardCheck = validateMergedResult(allResult);
  if (!hardCheck.ok) {
    const errMsg = "合并后硬校验失败:\n" + hardCheck.errors.join("\n");
    console.error(`[V2Parse] ${errMsg}`);
    console.error(`[V2Parse] 重复项:`, JSON.stringify(duplicates, null, 2));
    await pool.execute("UPDATE document_parse_runs SET status = 'failed', raw_ai_response = ? WHERE id = ?", [JSON.stringify({ error: errMsg, hardCheckErrors: hardCheck.errors, duplicates }), parseRunId]);
    await pool.execute("UPDATE rule_sets SET status = 'draft' WHERE id = ?", [ruleSetId]);
    await pool.execute("UPDATE rule_sources SET status = 'pending' WHERE id = ?", [sourceId]);
    throw new Error(errMsg);
  }

  // ===== 8. ★ 事务写入（仅全过）=====
  if (onProgress) await onProgress('writing', { phase: '事务写入中...' });
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const indicatorIds = {};
    async function writeIndicators(nodes, parentId) {
      for (const n of nodes) {
        const [ind] = await conn.execute(
          "INSERT INTO indicator_nodes (rule_set_id, canonical_key, code, name, parent_id, weight, calc_method, max_score, min_score, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending_review')",
          [ruleSetId, n.canonical_key, n.code, n.name, parentId, n.weight || null, sanitizeCalcMethod(n.calc_method), n.max_score || null, n.min_score || 0]
        );
        indicatorIds[n.code || n.canonical_key] = ind.insertId;
        if (n.children) await writeIndicators(n.children, ind.insertId);
      }
    }
    await writeIndicators(allResult.indicators, null);

    let ruleCount = 0, manualCount = 0;
    for (const pkg of (allResult.packages || [])) {
      const indId = pkg.indicator_code ? (indicatorIds[pkg.indicator_code] || indicatorIds[normKey(pkg.indicator_code)]) : null;
      const [rp] = await conn.execute(
        "INSERT INTO rule_packages (rule_set_id, indicator_id, canonical_key, name, summary, auto_level, status) VALUES (?, ?, ?, ?, ?, ?, 'pending_review')",
        [ruleSetId, indId, pkg.canonical_key, pkg.name, pkg.summary || '', pkg.auto_level || 'automatic']
      );
      for (const rule of (pkg.rules || [])) {
        if (rule.auto_level === 'manual_required') manualCount++;
        await conn.execute(
          "INSERT INTO executable_rules (package_id, canonical_key, rule_type, name, config, config_version, input_selector, condition_config, application_scope, execution_stage, priority, proof_required, auto_level, status) VALUES (?, ?, ?, ?, ?, 'v1', ?, ?, ?, ?, ?, ?, ?, 'pending_review')",
          [rp.insertId, rule.canonical_key, rule.rule_type, rule.name, JSON.stringify(rule.config || {}), JSON.stringify(rule.input_selector || null), JSON.stringify(rule.condition_config || null), rule.application_scope || 'per_fact', rule.execution_stage || 'base_score', rule.priority || 0, JSON.stringify(rule.proof_required || []), rule.auto_level || 'automatic']
        );
        ruleCount++;
      }
    }

    if (allResult.lookup_tables) {
      for (const t of allResult.lookup_tables) {
        const [lt] = await conn.execute("INSERT INTO lookup_tables (rule_set_id, canonical_key, name) VALUES (?, ?, ?)", [ruleSetId, t.canonical_key, t.name]);
        if (t.dimensions) for (const d of t.dimensions) await conn.execute("INSERT INTO lookup_dimensions (table_id, dim_name, dim_label) VALUES (?, ?, ?)", [lt.insertId, d.dim_name, d.dim_label]);
        if (t.cells) for (const c of t.cells) {
          const safeValue = sanitizeCellValue(c.value);
          await conn.execute(
            "INSERT INTO lookup_cells (table_id, dimension_values, dimension_hash, value) VALUES (?, ?, ?, ?)",
            [lt.insertId, JSON.stringify(c.dimension_values), crypto.createHash("sha256").update(JSON.stringify(c.dimension_values)).digest("hex").slice(0, 64), safeValue]
          );
        }
      }
    }

    const meta = `\n\n--- V2解析记录 ---\n模型: deepseek-chat\n任务数: ${parseTasks.length}\n成功: ${completedCount}\n失败: ${failedCount}\n去重合并: ${duplicates.length}项\n解析时间: ${new Date().toISOString()}`;
    await conn.execute("UPDATE rule_sources SET status = 'parsed', original_text = CONCAT(COALESCE(original_text,''), ?) WHERE id = ?", [meta, sourceId]);
    await conn.execute("UPDATE document_parse_runs SET status = ?, completed_at = NOW() WHERE id = ?", [taskFailures.length > 0 ? 'failed' : 'completed', parseRunId]);

    await conn.commit();
    return { rule_set_id: ruleSetId, indicator_count: Object.keys(indicatorIds).length, package_count: (allResult.packages || []).length, rule_count: ruleCount, manual_rule_count: manualCount, lookup_table_count: (allResult.lookup_tables || []).length, uncertainty_count: (allResult.uncertainties || []).length, chapter_count: chapters.length, task_count: parseTasks.length, task_success: completedCount, task_failed: failedCount, duplicate_count: duplicates.length };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally { conn.release(); }
}

/**
 * 清洗 AI 返回的查表单元格值，确保可写入 DECIMAL(6,2) 列
 * 支持：纯数字、数字字符串、{min, max} 范围对象、{default} 对象
 */
function sanitizeCellValue(v) {
  if (v == null) return 0;
  // 纯数字
  if (typeof v === 'number' && !isNaN(v)) return v;
  // 数字字符串
  if (typeof v === 'string') {
    const n = parseFloat(v);
    if (!isNaN(n)) return n;
    return 0;
  }
  // 范围对象 {min, max} / {min, max, default}
  if (typeof v === 'object') {
    if (typeof v.default === 'number') return v.default;
    if (typeof v.max === 'number') return v.max;
    if (typeof v.min === 'number') return v.min;
    // 取第一个数字属性
    for (const val of Object.values(v)) {
      if (typeof val === 'number') return val;
      if (typeof val === 'string') { const n = parseFloat(val); if (!isNaN(n)) return n; }
    }
  }
  console.warn('[V2Parse] 无法清洗 lookup cell value:', JSON.stringify(v).slice(0, 80));
  return 0;
}

/** 清洗 AI 输出的 calc_method → ENUM 允许值 */
const VALID_CALC = new Set(['sum_children','weighted_sum','formula_ast','lookup','direct']);
function sanitizeCalcMethod(v) {
  if (!v) return 'sum_children';
  const s = String(v).trim().toLowerCase().replace(/[\s\-]+/g, '_');
  if (VALID_CALC.has(s)) return s;
  // 常见 AI 输出映射
  if (s === 'sum' || s === 'add' || s === 'total') return 'sum_children';
  if (s === 'average' || s === 'avg' || s === 'mean') return 'weighted_sum';
  if (s === 'fixed' || s === 'fixed_base' || s === 'base_score') return 'direct';     // 固定基准分
  if (s === 'max' || s === 'maximum' || s === 'take_highest') return 'direct';
  if (s === 'min' || s === 'minimum') return 'direct';
  if (s === 'formula' || s === 'custom') return 'formula_ast';
  if (s === 'table' || s === 'lookup_table') return 'lookup';
  console.warn(`[V2Parse] 未知 calc_method "${v}" → sum_children`);
  return 'sum_children';
}

function sanitizeAutoLevel(v) {
  if (!v) return 'automatic';
  const s = String(v).trim().toLowerCase();
  if (s === 'auto' || s === 'automatic') return 'automatic';
  if (s === 'assisted') return 'assisted';
  if (s === 'manual' || s === 'manual_required') return 'manual_required';
  return 'automatic';
}

module.exports = { parseRuleSourceV2 };
