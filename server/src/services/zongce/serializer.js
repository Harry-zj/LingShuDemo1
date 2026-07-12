// ============================================================
//  统一序列化器 — 所有接口返回同一 fact/match 结构
// ============================================================
const { pool } = require("../../config/database");

/**
 * 序列化单个 fact（含 current match）
 */
async function serializeFact(efRow) {
  const factData = typeof efRow.fact_data === 'string' ? JSON.parse(efRow.fact_data) : efRow.fact_data;

  // 加载 current selected match
  let match = null;
  const [frmRows] = await pool.execute(
    `SELECT frm.*, rmr.rule_set_id
     FROM fact_rule_matches frm
     JOIN rule_match_runs rmr ON frm.match_run_id = rmr.id
     WHERE frm.extracted_fact_id = ? AND frm.is_current = 1 AND frm.is_selected = 1
     ORDER BY frm.id DESC LIMIT 1`,
    [efRow.id]
  );

  if (frmRows.length) {
    const frm = frmRows[0];
    // ★ 优先从 preview_data 读取（正式表），回退到 material_recognitions
    let extra = {};
    if (frm.preview_data) {
      try { extra = typeof frm.preview_data === 'string' ? JSON.parse(frm.preview_data) : frm.preview_data; } catch (_) {}
    }
    if (!extra.score_preview) {
      try {
        const [recs] = await pool.execute(
          "SELECT mr.raw_ai_response FROM material_recognitions mr JOIN material_analysis_runs mar ON mar.material_id = mr.material_id WHERE mar.id = ?",
          [efRow.analysis_run_id]
        );
        if (recs.length && recs[0].raw_ai_response) {
          const raw = typeof recs[0].raw_ai_response === 'string' ? JSON.parse(recs[0].raw_ai_response) : recs[0].raw_ai_response;
          if (raw?.preview_cache) {
            const pc = raw.preview_cache[efRow.fact_key];
            if (pc && pc.score_preview != null) extra = pc;
          }
        }
      } catch (_) {}
    }

    match = {
      fact_rule_match_id: frm.id,
      rule_match_run_id: frm.match_run_id,
      is_current: !!frm.is_current,
      is_selected: true,
      indicator: extra.indicator || null,
      rule: extra.rule || null,
      lookup_table: extra.lookup_table || null,
      lookup_cell: extra.lookup_cell || null,
      raw_dimensions: extra.lookup_dimensions || extra.raw_dimensions || {},
      normalized_dimensions: extra.normalized_dimensions || extra.lookup_dimensions || {},
      score_preview: extra.score_preview ?? null,
      score_status: extra.score_status || null,
      match_condition: frm.match_condition,
      review_status: frm.review_status,
      needs_review: frm.match_condition !== 'pass' || frm.review_status === 'pending',
      error_type: extra.error_type || null,
      reason: extra.human_readable || (frm.reason && !frm.reason.startsWith("验证") ? frm.reason : null),
      confidence: frm.confidence,
    };
  }

  // 加载 sources
  const [srcRows] = await pool.execute(
    "SELECT * FROM extracted_fact_sources WHERE extracted_fact_id = ?", [efRow.id]
  );

  return {
    fact_id: efRow.id,
    legacy_fact_key: efRow.fact_key,
    fact_type: efRow.fact_type,
    fact_data: factData,
    review_status: efRow.review_status || 'pending',
    semantic_hash: efRow.semantic_hash,
    confidence: efRow.confidence,
    sources: srcRows.map(s => ({
      attachment_id: s.attachment_id,
      source_text: s.raw_excerpt || '',
      source_locator: s.source_locator || '',
    })),
    match,
  };
}

/**
 * 序列化材料（含所有 facts + preview_summary）
 */
async function serializeMaterial(mat) {
  const result = {
    id: mat.id,
    title: mat.title || '',
    attachments: mat.attachments || [],
    facts: [],
    preview_summary: null,
  };

  // 从正式表加载 facts
  const [latestRun] = await pool.execute(
    "SELECT id FROM material_analysis_runs WHERE material_id = ? AND status IN ('completed','needs_review') ORDER BY id DESC LIMIT 1",
    [mat.id]
  );

  if (latestRun.length) {
    const [efRows] = await pool.execute(
      "SELECT * FROM extracted_facts WHERE analysis_run_id = ? AND status = 'active' ORDER BY id",
      [latestRun[0].id]
    );
    result.facts = await Promise.all(efRows.map(ef => serializeFact(ef)));
  }

  // 材料级汇总
  let confirmedScore = 0, candidateScore = 0;
  let scoredCount = 0, candidateCount = 0, pendingCount = 0, failedCount = 0;
  for (const f of result.facts) {
    const m = f.match;
    if (!m || m.score_preview == null) {
      if (m?.error_type) failedCount++; else pendingCount++;
    } else if (m.review_status === 'pending') {
      candidateScore += m.score_preview; candidateCount++;
    } else {
      confirmedScore += m.score_preview; scoredCount++;
    }
  }
  result.preview_summary = {
    confirmed_score: confirmedScore,
    candidate_score: candidateScore,
    scored_fact_count: scoredCount,
    candidate_fact_count: candidateCount,
    pending_fact_count: pendingCount,
    failed_fact_count: failedCount,
    total_fact_count: result.facts.length,
  };

  return result;
}

module.exports = { serializeFact, serializeMaterial };
