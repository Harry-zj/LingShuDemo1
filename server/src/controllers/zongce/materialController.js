const { pool } = require("../../config/database");
const Res = require("../../utils/response");
const { calculateScorePreview } = require("../../services/zongce/ai/materialPipeline");
const { matchFactPipeline, validateAndPersistMatch } = require("../../services/zongce/ai/ruleBlockMatcher");
const { extractStructuredFacts } = require("../../services/zongce/ai/factExtractor");
const { serializeMaterial, serializeFact } = require("../../services/zongce/serializer");

// 创建材料
exports.createMaterial = async (req, res) => {
  try {
    const { title } = req.body;
    const [r] = await pool.execute(
      "INSERT INTO materials (user_id, title) VALUES (?, ?)",
      [req.user.id, title || ""]
    );
    res.json(Res.success({ id: r.insertId, title: title || "", attachments: [], recognition: null }));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 获取材料列表（含附件和识别结果，一次查询避免 N+1）
exports.getMaterials = async (req, res) => {
  try {
    const [materials] = await pool.execute(
      "SELECT * FROM materials WHERE user_id = ? ORDER BY created_at DESC",
      [req.user.id]
    );
    if (!materials.length) return res.json(Res.success([]));

    const ids = materials.map((m) => m.id);
    const placeholders = ids.map(() => "?").join(",");

    // 批量查附件
    const [atts] = await pool.execute(
      `SELECT * FROM attachments WHERE material_id IN (${placeholders})`, ids
    );
    const attMap = {}; for (const a of atts) { (attMap[a.material_id] ||= []).push(a); }

    // ★ 统一序列化（不再依赖 material_recognitions）
    const result = [];
    for (const m of materials) {
      m.attachments = attMap[m.id] || [];
      const serialized = await serializeMaterial(m);
      result.push(serialized);
    }
    res.json(Res.success(result));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 上传证明文件
exports.uploadAttachments = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.files || req.files.length === 0) return res.json(Res.error("请选择文件"));
    const [mat] = await pool.execute("SELECT id FROM materials WHERE id = ? AND user_id = ?", [id, req.user.id]);
    if (!mat.length) return res.json(Res.error("材料不存在"));
    const inserted = [];
    for (const f of req.files) {
      const safeName = Buffer.from(f.originalname, 'latin1').toString('utf8');
      const [r] = await pool.execute(
        "INSERT INTO attachments (material_id, file_name, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?)",
        [id, safeName, f.filename, f.mimetype, f.size]
      );
      inserted.push({ id: r.insertId, file_name: safeName });
    }
    res.json(Res.success(inserted, `已上传 ${inserted.length} 个文件`));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 阶段 1：提取结构化事实（★ 幂等: 已有结果且未 force 时直接返回）
exports.extractMaterial = async (req, res) => {
  let runId = null;
  try {
    const { id } = req.params;
    const [mats] = await pool.execute("SELECT * FROM materials WHERE id = ? AND user_id = ?", [id, req.user.id]);
    if (!mats.length) return res.json(Res.error("材料不存在"));

    // ★ 幂等保护: 已有正式 facts 或 raw_ai_response 缓存 → 直接返回
    if (!req.query.force) {
      // 优先检查正式表
      const [latestRun] = await pool.execute(
        "SELECT id FROM material_analysis_runs WHERE material_id = ? AND status IN ('completed','needs_review') ORDER BY id DESC LIMIT 1", [id]
      );
      if (latestRun.length) {
        const [efs] = await pool.execute(
          "SELECT * FROM extracted_facts WHERE analysis_run_id = ? AND status = 'active' ORDER BY id", [latestRun[0].id]
        );
        if (efs.length) {
          const facts = await Promise.all(efs.map(ef => serializeFact(ef)));
          return res.json(Res.success({ facts, needs_review: false, from_cache: true }, `已有 ${facts.length} 条识别结果（缓存）`));
        }
      }
    }

    const [attachments] = await pool.execute("SELECT * FROM attachments WHERE material_id = ?", [id]);
    if (!attachments.length) return res.json(Res.error("请先上传证明文件"));

    // ★ 创建 analysis run（状态=processing）
    const crypto = require('crypto');
    const inputHash = crypto.createHash('sha256')
      .update(attachments.map(a => `${a.id}:${a.file_size}`).join('|'))
      .digest('hex').slice(0, 64);
    const [run] = await pool.execute(
      "INSERT INTO material_analysis_runs (material_id, model_name, prompt_version, parser_version, input_hash, status) VALUES (?, 'kimi+deepseek', 'v2.2', 'v2', ?, 'processing')",
      [id, inputHash]
    );
    runId = run.insertId;

    // 调 AI 提取
    const result = await extractStructuredFacts(attachments);

    // ★ 事务写入: extracted_facts + sources
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const factIds = [];
      for (let i = 0; i < result.facts.length; i++) {
        const f = result.facts[i];
        const legacyKey = f.fact_id || `f${i + 1}`;
        const fHash = crypto.createHash('sha256')
          .update(JSON.stringify({
            award_name: f.award_name, competition_name: f.competition_name,
            award_rank: f.award_rank, inferred_level: f.inferred_level,
            organizer: f.organizer, fact_type: f.fact_type,
          })).digest('hex').slice(0, 64);

        const [ef] = await conn.execute(
          `INSERT INTO extracted_facts (analysis_run_id, fact_key, fact_type, fact_data, semantic_hash, confidence, status)
           VALUES (?, ?, ?, ?, ?, ?, 'active')`,
          [runId, legacyKey, f.fact_type || 'other', JSON.stringify(f), fHash, f.confidence || 0.5]
        );
        const factId = ef.insertId;
        factIds.push(factId);

        // 写入来源（不伪造页码/坐标）
        const attId = f.attachment_id || (attachments[0]?.id);
        if (attId) {
          await conn.execute(
            "INSERT INTO extracted_fact_sources (extracted_fact_id, attachment_id, source_locator, raw_excerpt) VALUES (?, ?, ?, ?)",
            [factId, attId, f.source_file || '', (f.source_text || '').slice(0, 1000)]
          );
        }
      }

      // 更新 run 状态
      const runStatus = result.needs_review ? 'needs_review' : 'completed';
      await conn.execute(
        "UPDATE material_analysis_runs SET status = ?, completed_at = NOW(), output_hash = ? WHERE id = ?",
        [runStatus, crypto.createHash('sha256').update(JSON.stringify(factIds)).digest('hex').slice(0, 64), runId]
      );

      await conn.commit();

      // ★ 不再写 material_recognitions.raw_ai_response（正式表为权威源）
    } catch (txErr) {
      await conn.rollback();
      // 更新 run 为 failed，保留旧成功结果
      await pool.execute("UPDATE material_analysis_runs SET status = 'failed', completed_at = NOW() WHERE id = ?", [runId]);
      throw txErr;
    } finally {
      conn.release();
    }

    // 更新 title
    const label = result.facts.map(f => f.award_name || f.competition_name || '').filter(Boolean).join(', ').slice(0, 200) || '未识别';
    await pool.execute("UPDATE materials SET title = ? WHERE id = ?", [label, id]);

    // ★ 回读序列化格式（fact_id=DB id, fact_data 嵌套, match 对象等）
    const [efRows] = await pool.execute(
      "SELECT * FROM extracted_facts WHERE analysis_run_id = ? AND status = 'active' ORDER BY id",
      [runId]
    );
    const facts = await Promise.all(efRows.map(ef => serializeFact(ef)));
    res.json(Res.success({ facts, analysis_run_id: runId, needs_review: result.needs_review }, `识别到 ${facts.length} 条事实`));
  } catch (e) {
    console.error('[Material] 提取失败:', e.message);
    if (runId) {
      try { await pool.execute("UPDATE material_analysis_runs SET status = 'failed', completed_at = NOW() WHERE id = ?", [runId]); } catch (_) {}
    }
    res.json(Res.error("识别失败，请稍后重试"));
  }
};

// PREVIEW ONLY — 阶段 2：规则匹配 + 分数预览（两阶段 Kimi 管线）
// 不写入 rule_match_runs / fact_rule_matches / calculation_rule_applications
exports.previewScore = async (req, res) => {
  try {
    const { id } = req.params;
    const { fact } = req.body;
    if (!fact) return res.json(Res.error("请提供事实数据"));

    const [ruleSets] = await pool.execute(
      "SELECT id FROM rule_sets WHERE user_id = ? AND status = 'published' ORDER BY published_at DESC LIMIT 1",
      [req.user.id]
    );
    if (!ruleSets.length) return res.json(Res.error("请先发布有效规则集"));
    const ruleSetId = ruleSets[0].id;

    // 跑完整匹配管线 (Phase 1+2: AI)
    const matchResult = await matchFactPipeline(fact, ruleSetId);

    // ★ AI 完全失败（API 不可用等）→ 无法继续
    if (matchResult.status === 'failed') {
      return res.json(Res.success({
        status: 'failed',
        failure_reason: matchResult.failure_reason || 'match_not_executed',
        reason: matchResult.reason || 'AI 匹配服务不可用',
        phase1_candidates: matchResult.phase1_candidates || null,
        score_preview: null, score_status: null,
        needs_review: true,
        indicator: null, rule: null, lookup_table: null, lookup_cell: null,
        lookup_dimensions: {}, normalized_fields: {}, confidence: null,
        error_type: 'ai_unavailable',
        missing_fields: [],
        calculation_steps: [],
      }));
    }

    // ★ needs_review 但 AI 返回了候选 → 仍然尝试确定性查表
    //   区分：业务资格存疑 (candidate_pending_review) vs 维度不存在 (match_not_executed)
    const phase2 = matchResult.phase2_result || {};

    // 判断是否有足够信息执行查表
    const hasIndicator = !!(phase2.selected_indicator_id || phase2.selected_rule_block || fact.suggested_rule_block);
    const hasDimensions = !!(phase2.score_dimensions && Object.keys(phase2.score_dimensions).length > 0);
    const canTryLookup = hasIndicator || phase2.matched_lookup_table_id;

    if (matchResult.status === 'needs_review' && !canTryLookup) {
      // ★ 真·无法匹配：没有候选 indicator，没有 lookup table
      return res.json(Res.success({
        status: 'needs_review',
        failure_reason: 'match_not_executed',
        reason: matchResult.reason || '无法确定匹配',
        phase1_candidates: matchResult.phase1_candidates,
        score_preview: null, score_status: null,
        needs_review: true,
        indicator: null, rule: null, lookup_table: null, lookup_cell: null,
        lookup_dimensions: {}, normalized_fields: {}, confidence: phase2.confidence || null,
        error_type: 'match_not_executed',
        missing_fields: [], review_reason: matchResult.reason || null,
        calculation_steps: [],
      }));
    }

    // ★ 有候选信息 → 执行确定性查表（Phase 3）
    const selectedBlock = phase2.selected_rule_block || fact.suggested_rule_block;
    const preview = await calculateScorePreview(fact, ruleSetId, {
      selected_rule_block: selectedBlock,
      matched_rule_ids: phase2.matched_rule_ids || [],
      matched_lookup_table_id: phase2.matched_lookup_table_id || null,
      score_dimensions: phase2.score_dimensions || {},
      normalized_fields: phase2.normalized_fields || {},
    });

    // ★ 确定 score_status
    let scoreStatus = 'confirmed';  // 默认：匹配成功
    if (matchResult.status === 'needs_review' && preview.score_preview !== null) {
      scoreStatus = 'candidate_pending_review';  // 业务资格待确认，但维度查表成功
    } else if (preview.score_preview === null && preview.error_type) {
      scoreStatus = 'lookup_failed';  // 查表失败
    }

    // ★ 提取 match 子对象需要引用的字段（避免 TDZ）
    const matchRule = preview.matched_rule ? {
      id: null, name: preview.matched_rule.table_name || null, rule_type: 'lookup',
    } : null;
    const matchLookupTable = preview.matched_rule ? {
      id: preview.matched_table_id || null, name: preview.matched_rule.table_name || null,
    } : null;
    const matchLookupCell = preview.matched_rule ? {
      id: null, value: preview.score,
    } : null;
    const matchLookupDims = preview._debug?.raw_dimensions
      || preview._debug?.canonical_dimensions || {};
    const matchNormFields = phase2.normalized_fields || {};

    // ★ 构建响应数据
    const responseData = {
      status: scoreStatus === 'candidate_pending_review' ? 'candidate_pending_review'
        : preview.consistency_conflict ? 'consistency_conflict'
        : preview.error_type ? 'lookup_failed'
        : 'matched',
      score_status: scoreStatus,
      score_preview: preview.score_preview,
      // 指标
      indicator: {
        id: preview.indicator_id || null,
        code: preview.indicator_code || preview.indicator?.code || null,
        name: preview.indicator_name || preview.indicator?.name || null,
      },
      // 规则
      rule: matchRule,
      // 查分表
      lookup_table: matchLookupTable,
      // 命中的 cell
      lookup_cell: matchLookupCell,
      // ★ 三阶段状态
      classification_status: preview.classification_status || 'unmatched',
      dimension_status: preview.dimension_status || 'unknown',
      raw_dimensions: preview.raw_dimensions || {},
      normalized_dimensions: preview.normalized_dimensions || {},
      unmapped_dimensions: preview.unmapped_dimensions || [],
      // 维度信息
      lookup_dimensions: matchLookupDims,
      normalized_fields: matchNormFields,
      // 匹配元信息
      business_type: phase2.business_type || null,
      source_authority: phase2.source_authority || null,
      recommended_policy: phase2.recommended_policy || null,
      explicit_exclusion_hit: phase2.explicit_exclusion_hit || null,
      special_override_hit: phase2.special_override_hit || null,
      confidence: phase2.confidence || null,
      needs_review: preview.needs_review || matchResult.status === 'needs_review',
      review_reason: phase2.review_reason || matchResult.reason || null,
      error_type: preview.error_type || null,
      missing_fields: preview.missing_fields || [],
      consistency_conflict: preview.consistency_conflict || false,
      calculation_steps: preview.explanation ? [preview.explanation] : [],
      // Phase 1/2 信息
      selected_block: selectedBlock || null,
      matched_rule_ids: phase2.matched_rule_ids || [],
      evidence: phase2.evidence || [],
      // ★ match 对象（含预览信息，正式 ID 后续填充）
      match: {
        fact_rule_match_id: null,
        is_current: false,
        is_selected: false,
        indicator: preview.indicator_code ? { code: preview.indicator_code, name: preview.indicator_name } : null,
        rule: matchRule,
        lookup_table: matchLookupTable,
        lookup_cell: matchLookupCell,
        raw_dimensions: matchLookupDims,
        normalized_dimensions: matchNormFields,
        score_preview: preview.score_preview,
        score_status: scoreStatus,
        review_status: 'pending',
        error_type: preview.error_type || null,
      },
      _debug: preview._debug || {},
    };

    // ★ 即时持久化 preview_cache 到 raw_ai_response（刷新不丢）
    try {
      const [recs] = await pool.execute(
        "SELECT id, raw_ai_response FROM material_recognitions WHERE material_id = ?", [id]
      );
      if (recs.length) {
        let raw = recs[0].raw_ai_response;
        if (typeof raw === 'string') { try { raw = JSON.parse(raw); } catch (_) { raw = {}; } }
        if (!raw || typeof raw !== 'object') raw = {};
        if (!raw.preview_cache) raw.preview_cache = {};

        // 生成稳定的 fact_key（优先用 fact_id，其次用内容 hash）
        const crypto = require('crypto');
        const factKey = fact.fact_id || fact.fact_key
          || crypto.createHash('sha256').update(JSON.stringify(fact)).digest('hex').slice(0, 16);

        // 生成 fact_hash 用于缓存校验
        const factHash = crypto.createHash('sha256')
          .update(JSON.stringify({
            award_name: fact.award_name, competition_name: fact.competition_name,
            award_rank: fact.award_rank, inferred_level: fact.inferred_level,
            organizer: fact.organizer, is_team: fact.is_team,
          })).digest('hex').slice(0, 32);

        raw.preview_cache[factKey] = {
          rule_set_id: ruleSetId,
          fact_hash: factHash,
          score_preview: preview.score_preview,
          score_status: scoreStatus,
          indicator: responseData.indicator,
          rule: responseData.rule,
          lookup_table: responseData.lookup_table,
          lookup_cell: responseData.lookup_cell,
          lookup_dimensions: responseData.lookup_dimensions,
          needs_review: responseData.needs_review,
          review_reason: responseData.review_reason,
          error_type: responseData.error_type,
          generated_at: new Date().toISOString(),
        };

        await pool.execute(
          "UPDATE material_recognitions SET raw_ai_response = ? WHERE id = ?",
          [JSON.stringify(raw), recs[0].id]
        );
      }
    } catch (e) { console.warn('[Material] preview_cache 写入失败:', e.message); }

    // ★ 正式匹配入库: rule_match_run + fact_rule_matches
    try {
      const [latestRun] = await pool.execute(
        "SELECT id FROM material_analysis_runs WHERE material_id = ? AND status IN ('completed','needs_review') ORDER BY id DESC LIMIT 1",
        [id]
      );
      if (latestRun.length) {
        // 找到对应 extracted_fact（通过 semantic_hash 匹配）
        const factHash = require('crypto').createHash('sha256')
          .update(JSON.stringify({
            award_name: fact.award_name, competition_name: fact.competition_name,
            award_rank: fact.award_rank, inferred_level: fact.inferred_level,
            organizer: fact.organizer, fact_type: fact.fact_type,
          })).digest('hex').slice(0, 64);

        const [efRows] = await pool.execute(
          "SELECT id FROM extracted_facts WHERE analysis_run_id = ? AND semantic_hash = ? AND status = 'active' LIMIT 1",
          [latestRun[0].id, factHash]
        );

        if (efRows.length) {
          const vResult = await validateAndPersistMatch(
            fact, efRows[0].id, latestRun[0].id, ruleSetId,
            matchResult, preview,
            { score_preview: preview.score_preview, score_status: scoreStatus,
              indicator: responseData.indicator,
              rule: responseData.rule, lookup_table: responseData.lookup_table,
              lookup_dimensions: responseData.lookup_dimensions,
              error_type: preview.error_type, dimension_status: preview.dimension_status }
          );
          responseData.match_validation = vResult;

          // ★ 回读 fact_rule_match_id，构建 match 对象供前端使用
          const [frmRows] = await pool.execute(
            "SELECT id FROM fact_rule_matches WHERE match_run_id = ? AND extracted_fact_id = ? AND is_current = 1 AND is_selected = 1 LIMIT 1",
            [vResult.match_run_id, efRows[0].id]
          );
          if (frmRows.length) {
            responseData.match.fact_rule_match_id = frmRows[0].id;
            responseData.match.is_current = true;
            responseData.match.is_selected = true;
            responseData.match.review_status = 'pending';
          }
        }
      }
    } catch (e) { console.warn('[Material] 正式匹配入库失败:', e.message); }

    res.json(Res.success(responseData));
  } catch (e) { console.error('[Material] 匹配失败:', e.message); res.json(Res.error("匹配失败，请稍后重试")); }
};

// 一键分析（兼容旧接口）
exports.analyzeMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    const [atts] = await pool.execute("SELECT * FROM attachments WHERE material_id = ?", [id]);
    if (!atts.length) return res.json(Res.error("请先上传证明文件"));
    const result = await extractStructuredFacts(atts);
    res.json(Res.success(result, "AI 分析完成"));
  } catch (e) { console.error('[Material] 分析失败:', e.message); res.json(Res.error("分析失败，请稍后重试")); }
};

// 阶段 3：确认单条匹配（★ 精确 UPDATE 单条 fact_rule_match）
exports.matchMaterial = async (req, res) => {
  try {
    const { id } = req.params;  // material_id
    const { fact_rule_match_id, extracted_fact_id } = req.body;

    // ★ 必填校验
    if (!fact_rule_match_id || !extracted_fact_id) {
      return res.json(Res.error("缺少必要参数: fact_rule_match_id / extracted_fact_id"));
    }

    // ★ 校验 match 存在、属于该 material
    const [matches] = await pool.execute(
      `SELECT frm.*, mar.material_id
       FROM fact_rule_matches frm
       JOIN rule_match_runs rmr ON frm.match_run_id = rmr.id
       JOIN material_analysis_runs mar ON rmr.analysis_run_id = mar.id
       WHERE frm.id = ? AND frm.extracted_fact_id = ?`,
      [fact_rule_match_id, extracted_fact_id]
    );
    if (!matches.length) {
      return res.json(Res.error("匹配记录不存在"));
    }
    if (matches[0].material_id !== Number(id)) {
      return res.json(Res.error("匹配记录不属于该材料"));
    }

    // ★ 幂等：已确认 → 直接返回
    if (matches[0].review_status === 'confirmed') {
      return res.json(Res.success({
        match_id: fact_rule_match_id,
        already_confirmed: true,
      }, "已确认（无需重复操作）"));
    }

    // ★ 双表精确 UPDATE
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const [frmResult] = await conn.execute(
        `UPDATE fact_rule_matches SET review_status = 'confirmed'
         WHERE id = ? AND extracted_fact_id = ? AND is_current = 1`,
        [fact_rule_match_id, extracted_fact_id]
      );
      if (frmResult.affectedRows === 0) {
        await conn.rollback();
        conn.release();
        return res.json(Res.error("更新失败：匹配不存在或已过期"));
      }

      await conn.execute(
        "UPDATE extracted_facts SET review_status = 'confirmed' WHERE id = ?",
        [extracted_fact_id]
      );

      await conn.commit();

      // ★ 回读序列化
      const [efRows] = await conn.execute("SELECT * FROM extracted_facts WHERE id = ?", [extracted_fact_id]);
      const fact = efRows.length ? await serializeFact(efRows[0]) : null;

      res.json(Res.success({
        affectedRows: frmResult.affectedRows,
        match_id: fact_rule_match_id,
        fact: fact,
      }, "已确认"));
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  } catch (e) { console.error('[Material] 确认失败:', e.message); res.json(Res.error("确认失败，请稍后重试")); }
};

// 删除材料（级联删除附件和识别结果）
exports.deleteMaterial = async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute("DELETE FROM material_recognitions WHERE material_id = ?", [id]);
    await pool.execute("DELETE FROM attachments WHERE material_id = ?", [id]);
    await pool.execute("DELETE FROM materials WHERE id = ? AND user_id = ?", [id, req.user.id]);
    res.json(Res.success(null, "已删除"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 删除单个附件
exports.deleteAttachment = async (req, res) => {
  try {
    const { matId, attId } = req.params;
    await pool.execute("DELETE FROM attachments WHERE id = ? AND material_id = ?", [attId, matId]);
    res.json(Res.success(null, "已删除"));
  } catch (e) { res.json(Res.error(e.message)); }
};
