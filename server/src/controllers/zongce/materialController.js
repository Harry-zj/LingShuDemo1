const { pool } = require("../../config/database");
const Res = require("../../utils/response");
const path = require("path");
const { uploadBuffer, generateKey } = require("../../services/oss");
const { calculateScorePreview, generateDescription } = require("../../services/zongce/ai/materialPipeline");
// Legacy: ruleBlockMatcher used by previewScore/matchMaterial (V3 migration target)
const { matchFactPipeline, validateAndPersistMatch } = require("../../services/zongce/ai/ruleBlockMatcher");
// New: text similarity matcher for simplified pipeline
const { matchFactsToRulesBatch } = require("../../services/zongce/ai/textSimilarityMatcher");
const { extractStructuredFacts, inferFactType } = require("../../services/zongce/ai/factExtractor");
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
// ★ 支持 batch_id 过滤：提供时仅返回在当前批次规则集下有匹配的材料
exports.getMaterials = async (req, res) => {
  try {
    const batchId = req.query.batch_id ? Number(req.query.batch_id) : 0;

    let materials;
    if (batchId) {
      // ★ 按批次过滤：返回 ① 在当前批次有已确认匹配的材料 ② 尚未被分析过的新材料
      const [rows] = await pool.execute(
        `SELECT DISTINCT m.* FROM materials m
         LEFT JOIN material_analysis_runs mar ON mar.material_id = m.id
         LEFT JOIN extracted_facts ef ON ef.analysis_run_id = mar.id AND ef.status = 'active'
         LEFT JOIN fact_rule_matches frm ON frm.extracted_fact_id = ef.id
            AND frm.is_current = 1 AND frm.review_status = 'confirmed'
         LEFT JOIN rule_match_runs rmr ON frm.match_run_id = rmr.id
         LEFT JOIN rule_sets rs ON rmr.rule_set_id = rs.id AND rs.status = 'published'
         WHERE m.user_id = ? AND (mar.id IS NULL OR rs.batch_id = ?)
         ORDER BY m.created_at DESC`,
        [req.user.id, batchId]
      );
      materials = rows;
    } else {
      [materials] = await pool.execute(
        "SELECT * FROM materials WHERE user_id = ? ORDER BY created_at DESC",
        [req.user.id]
      );
    }

    if (!materials.length) return res.json(Res.success([]));

    const ids = materials.map((m) => m.id);
    const placeholders = ids.map(() => "?").join(",");

    // 批量查附件
    const [atts] = await pool.execute(
      `SELECT * FROM attachments WHERE material_id IN (${placeholders})`, ids
    );
    const attMap = {}; for (const a of atts) { (attMap[a.material_id] ||= []).push(a); }

    // 查正在识别中的材料
    const [running] = await pool.execute(
      `SELECT DISTINCT material_id FROM material_analysis_runs WHERE material_id IN (${placeholders}) AND status = 'running'`, ids
    );
    const runningIds = new Set(running.map(r => r.material_id));

    // ★ 统一序列化（不再依赖 material_recognitions）
    const result = [];
    for (const m of materials) {
      m.attachments = attMap[m.id] || [];
      const serialized = await serializeMaterial(m);
      serialized._extracting = runningIds.has(m.id);
      result.push(serialized);
    }
    res.json(Res.success(result));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 上传证明文件（★ OSS: buffer → 上传云端 → 存完整 URL 到 file_path）
exports.uploadAttachments = async (req, res) => {
  try {
    const { id } = req.params;
    if (!req.files || req.files.length === 0) return res.json(Res.error("请选择文件"));
    const [mat] = await pool.execute("SELECT id FROM materials WHERE id = ? AND user_id = ?", [id, req.user.id]);
    if (!mat.length) return res.json(Res.error("材料不存在"));
    const inserted = [];
    for (const f of req.files) {
      const safeName = Buffer.from(f.originalname, 'latin1').toString('utf8');
      // ★ 上传 buffer 到 OSS，获取完整公开 URL
      const ossKey = generateKey(safeName);
      let filePath;
      try {
        filePath = await uploadBuffer(f.buffer, ossKey, f.mimetype);
      } catch (ossErr) {
        console.error('[Upload] OSS 上传失败，回退到本地存储:', ossErr.message);
        // 回退：OSS 不可用时写本地磁盘
        const fs = require("fs");
        const localPath = path.join(__dirname, "../../../uploads", ossKey);
        fs.writeFileSync(localPath, f.buffer);
        filePath = ossKey; // 裸文件名，兼容旧逻辑
      }
      const [r] = await pool.execute(
        "INSERT INTO attachments (material_id, file_name, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?)",
        [id, safeName, filePath, f.mimetype, f.size]
      );
      inserted.push({ id: r.insertId, file_name: safeName, url: filePath });
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
// V3: also run score matching on cache hit
          console.log('[Extract] Cache hit, running V3 auto-match...');
          let spCache = [];
          try {
            // ★ 按学生的学院+年级匹配批次，再查该批次的已发布规则集（规则由管理员上传，不以 user_id 限制）
            const [batchRows] = await pool.execute(
              "SELECT id FROM assessment_batches WHERE college = (SELECT college FROM users WHERE id = ?) AND grade = (SELECT grade FROM users WHERE id = ?) AND status <> 'deleted' ORDER BY school_year DESC LIMIT 1",
              [req.user.id, req.user.id]
            );
            const batchId = batchRows.length > 0 ? batchRows[0].id : null;
            const [spRsCache] = await pool.execute(
              "SELECT id FROM rule_sets WHERE batch_id = ? AND status = 'published' ORDER BY published_at DESC LIMIT 1",
              [batchId]
            );
            if (spRsCache.length) {
              for (const ef of efs) {
                try {
                  // ★ mysql2 自动解析 JSON 列，需兼容 string / object
                  const fd = typeof ef.fact_data === 'string' ? JSON.parse(ef.fact_data || '{}') : (ef.fact_data || {});
                  const rawType = ef.fact_type || fd.type || 'other';
                  // ★ 合并所有字段，确保 buildFactDescription 能读取完整信息
                  const mergedDetail = { ...fd, ...(fd.detail || {}), source_text: fd.source_text || '', inferred_level: fd.inferred_level || '' };
                  const fo = {
                    fact_id: String(ef.id),
                    type: rawType === 'other' ? inferFactType(fd) : rawType,
                    value: fd.value || fd.award_name || fd.competition_name || '',
                    source_text: fd.source_text || '',         // ★ 原文
                    inferred_level: fd.inferred_level || '',   // ★ 推断级别
                    award_rank: fd.award_rank || fd.rank || '',
                    detail: mergedDetail,
                  };
                  console.log(`[Extract] Cache fact ${ef.id}: type=${fo.type} value="${fo.value?.slice(0,50)}" source_len=${fo.source_text?.length||0} detailKeys=${Object.keys(mergedDetail).slice(0,8).join(',')}`);
                  const sp = await calculateScorePreview(fo, spRsCache[0].id, req.user.id);
                  // 只有匹配到具体规则（score_preview != null）才加入缓存
                  if (sp && sp.score_preview != null) {
                    sp._ef_id = ef.id;
                    sp.ai_description = sp.ai_description || await generateDescription(fo, sp.matched_rule, sp.score_preview);
                    spCache.push(sp);
                  } else {
                    console.log(`[Extract] 事实 ${ef.id} 未能匹配规则: ${sp?.explanation || 'unknown'}`);
                  }
                } catch(e2){}
              }
              // ★ 修复重复加分: 将同一材料下使用旧 rule_set 的 confirmed 匹配标记为 is_current=0
              try {
                const efIds = efs.map(ef => ef.id);
                if (efIds.length) {
                  const ph = efIds.map(() => '?').join(',');
                  const [oldMatches] = await pool.execute(
                    `SELECT frm.id FROM fact_rule_matches frm
                     JOIN rule_match_runs rmr ON frm.match_run_id = rmr.id
                     WHERE frm.extracted_fact_id IN (${ph})
                       AND frm.is_current = 1
                       AND rmr.rule_set_id != ?`,
                    [...efIds, spRsCache[0].id]
                  );
                  if (oldMatches.length > 0) {
                    await pool.execute(
                      `UPDATE fact_rule_matches frm
                       JOIN rule_match_runs rmr ON frm.match_run_id = rmr.id
                       SET frm.is_current = 0
                       WHERE frm.extracted_fact_id IN (${ph})
                         AND frm.is_current = 1
                         AND rmr.rule_set_id != ?`,
                      [...efIds, spRsCache[0].id]
                    );
                    console.log(`[Extract] 规则集已变更，${oldMatches.length} 条旧匹配已置为 is_current=0`);
                  }
                }
              } catch(e4) { console.warn('[Extract] invalidate old matches fail:', e4.message); }
            }
          } catch(e3){ console.warn('[Extract] cache match fail:', e3.message); }
          // Persist match results
          for (const sp of spCache) {
            try {
              const efId = efs.find(ef => String(ef.id) === sp._ef_id) || efs[0];
              if (efId) await pool.execute("UPDATE extracted_facts SET fact_data = JSON_SET(COALESCE(fact_data,'{}'), '$.match_score', ?, '$.match_rule', ?, '$.match_sim', ?) WHERE id = ?", [sp.score_preview, sp.matched_rule?.name || '', sp.similarity_score || 0, efId.id]);
            } catch(_) {}
          }
          return res.json(Res.success({ facts, needs_review: false, from_cache: true, score_previews: spCache }, `已有 ${facts.length} 条识别结果，匹配到 ${spCache.length} 条计分规则（缓存）`));
        }
      }
    }

    const [attachments] = await pool.execute("SELECT * FROM attachments WHERE material_id = ?", [id]);
    if (!attachments.length) return res.json(Res.error("请先上传证明文件"));

    // ★ 创建 analysis run 前，标记旧数据为过期
    const crypto = require('crypto');
    // 1. 标记旧的 extracted_facts 为 superseded
    await pool.execute(
      `UPDATE extracted_facts SET status = 'superseded'
       WHERE analysis_run_id IN (SELECT id FROM material_analysis_runs WHERE material_id = ? AND status IN ('completed','needs_review'))
       AND status = 'active'`, [id]
    );
    // 2. 标记旧的 fact_rule_matches 为 is_current=0
    await pool.execute(
      `UPDATE fact_rule_matches SET is_current = 0
       WHERE extracted_fact_id IN (
         SELECT id FROM extracted_facts WHERE analysis_run_id IN (
           SELECT id FROM material_analysis_runs WHERE material_id = ?
         ) AND status = 'superseded'
       ) AND is_current = 1`, [id]
    );

    const inputHash = crypto.createHash('sha256')
      .update(attachments.map(a => `${a.id}:${a.file_size}`).join('|'))
      .digest('hex').slice(0, 64);
    const [run] = await pool.execute(
      "INSERT INTO material_analysis_runs (material_id, model_name, prompt_version, parser_version, input_hash, status) VALUES (?, 'kimi+deepseek', 'v2.2', 'v2', ?, 'running')",
      [id, inputHash]
    );
    runId = run.insertId;

    // 调 AI 提取
    const result = await extractStructuredFacts(attachments);
    console.log("[Extract] result.facts count:", result?.facts?.length||0);
    if (result?.facts?.length) console.log("[Extract] first fact:", JSON.stringify(result.facts[0]).slice(0,200)); else console.log("[Extract] WARN: ZERO facts!");
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
    const label = result.facts.map(f => f.value || f.award_name || f.competition_name || '').filter(Boolean).join(', ').slice(0, 200) || '未命名材料';
    await pool.execute("UPDATE materials SET title = ? WHERE id = ?", [label, id]);

    // ★ 回读序列化格式（fact_id=DB id, fact_data 嵌套, match 对象等）
    const [efRows] = await pool.execute(
      "SELECT * FROM extracted_facts WHERE analysis_run_id = ? AND status = 'active' ORDER BY id",
      [runId]
    );
    const facts = await Promise.all(efRows.map(ef => serializeFact(ef)));
    // V3: auto-match facts to scoring_rules
    console.log('[Extract] V3 auto-match starting, efRows:', efRows.length);
    let scorePreviews = [];
    try {
      // ★ 按学生的学院+年级匹配批次，再查该批次的已发布规则集
      const [batchRows] = await pool.execute(
        "SELECT id FROM assessment_batches WHERE college = (SELECT college FROM users WHERE id = ?) AND grade = (SELECT grade FROM users WHERE id = ?) AND status <> 'deleted' ORDER BY school_year DESC LIMIT 1",
        [req.user.id, req.user.id]
      );
      const batchId = batchRows.length > 0 ? batchRows[0].id : null;
      const [spRs] = await pool.execute(
        "SELECT id FROM rule_sets WHERE batch_id = ? AND status = 'published' ORDER BY published_at DESC LIMIT 1",
        [batchId]
      );
      console.log('[Extract] published ruleSet found:', spRs.length > 0);
      if (spRs.length) {
        const spRid = spRs[0].id;
        for (const ef of efRows) {
          try {
            // ★ mysql2 自动解析 JSON 列，需兼容 string / object
            const fd = typeof ef.fact_data === 'string' ? JSON.parse(ef.fact_data || '{}') : (ef.fact_data || {});
            const rawType = ef.fact_type || fd.type || 'other';
            // ★ 合并所有字段，确保 buildFactDescription 能读取完整信息
            const mergedDetail = { ...fd, ...(fd.detail || {}), source_text: fd.source_text || '', inferred_level: fd.inferred_level || '' };
            const fo = {
              fact_id: String(ef.id),
              type: rawType === 'other' ? inferFactType(fd) : rawType,
              value: fd.value || fd.award_name || fd.competition_name || '',
              source_text: fd.source_text || '',
              inferred_level: fd.inferred_level || '',
              award_rank: fd.award_rank || fd.rank || '',
              detail: mergedDetail,
            };
            console.log(`[Extract] Fresh fact ${ef.id}: type=${fo.type} value="${fo.value?.slice(0,50)}" source_len=${fo.source_text?.length||0} detailKeys=${Object.keys(mergedDetail).slice(0,8).join(',')}`);
            const sp = await calculateScorePreview(fo, spRid, req.user.id);
            if (sp && sp.score_preview != null) { sp._ef_id = ef.id; sp.ai_description = await generateDescription(fo, sp.matched_rule, sp.score_preview); scorePreviews.push(sp); }
          } catch(e2){}
        }
      }
    } catch(e3){}
    // Persist match to extracted_facts
    for (const sp of scorePreviews) {
      try {
        if (sp._ef_id) await pool.execute("UPDATE extracted_facts SET fact_data = JSON_SET(COALESCE(fact_data,'{}'), '$.match_score', ?, '$.match_rule', ?, '$.match_sim', ?, '$.match_item_key', ?, '$.match_desc', ?, '$.match_rule_obj', CAST(? AS JSON)) WHERE id = ?", [sp.score_preview, sp.matched_rule?.name || '', sp.similarity_score || 0, sp.indicator_code || '', sp.ai_description || '', JSON.stringify(sp.matched_rule || {}), sp._ef_id]);
      } catch(_) {}
    }
    res.json(Res.success({ facts, analysis_run_id: runId, needs_review: result.needs_review, score_previews: scorePreviews }, `识别到 ${facts.length} 条事实，匹配到 ${scorePreviews.length} 条计分规则`));
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

    // ★ 按批次查询已发布规则集（不限制 user_id）
    const [btRows] = await pool.execute(
      "SELECT id FROM assessment_batches WHERE college = (SELECT college FROM users WHERE id = ?) AND grade = (SELECT grade FROM users WHERE id = ?) AND status <> 'deleted' ORDER BY school_year DESC LIMIT 1",
      [req.user.id, req.user.id]
    );
    const batchId = btRows.length > 0 ? btRows[0].id : null;
    const [ruleSets] = await pool.execute(
      "SELECT id FROM rule_sets WHERE batch_id = ? AND status = 'published' ORDER BY published_at DESC LIMIT 1",
      [batchId]
    );
    if (!ruleSets.length) return res.json(Res.error("请先发布有效规则集"));
    const ruleSetId = ruleSets[0].id;

    // 跑完整匹配管线 (Phase 1+2: AI)
    const preview = await calculateScorePreview(fact, ruleSetId, req.user.id);

    const v3status = preview.needs_review ? 'needs_review' : 'completed';
    const v3scoreStatus = preview.score_preview != null ? 'confirmed' : 'lookup_failed';

    return res.json(Res.success({
      status: v3status, score_preview: preview.score_preview, score_status: v3scoreStatus,
      needs_review: preview.needs_review, indicator: preview.matched_rule,
      rule: preview.matched_rule, matched_rule_id: preview.matched_rule_id,
      indicator_code: preview.indicator_code, indicator_name: preview.indicator_name,
      confidence: preview.confidence || 0, similarity_score: preview.similarity_score || 0,
      candidates: preview.candidates || [], match_method: 'tfidf_similarity',
      failure_reason: preview.needs_review ? 'low_similarity' : null,
      reason: preview.human_readable || preview.explanation || '',
      error_type: preview.needs_review ? 'low_similarity' : null,
      missing_fields: [], calculation_steps: [],
    }));

  } catch (e) {
    console.error('[Material] preview error:', e.message);
    res.json(Res.error("Preview failed"));
  }
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

    // ★ Phase 1: 事务更新确认状态（独立错误处理，失败即回滚）
    const conn = await pool.getConnection();
    let frmResult;
    try {
      await conn.beginTransaction();

      [frmResult] = await conn.execute(
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
    } catch (e) {
      await conn.rollback();
      conn.release();
      console.error('[Material] 确认事务失败:', e.message);
      return res.json(Res.error("确认失败，请稍后重试"));
    }
    conn.release();

    // Phase 3: 识别 indicator — 不再自动写入 smart_fill_data
    // smart_fill_data 仅由用户通过 saveFillData 手动编辑时写入（作为覆盖）
    // F3 数据聚合由 getFillData() 直接从 fact_rule_matches 读取
    try {
      // (保留 try 块结构以避免外层异常，实际逻辑已移除)
    } catch (e) { console.warn('[Mat] sfw fail:', e.message); }


    // ★ Phase 2: 回读序列化（独立错误处理，失败不回滚、不误报）
    //   事务已提交，确认已生效；序列化失败仅影响返回数据的可读性
    try {
      const [efRows] = await pool.execute(
        "SELECT * FROM extracted_facts WHERE id = ?",
        [extracted_fact_id]
      );
      const fact = efRows.length ? await serializeFact(efRows[0]) : null;

      res.json(Res.success({
        affectedRows: frmResult.affectedRows,
        match_id: fact_rule_match_id,
        fact: fact,
      }, "已确认"));
    } catch (e) {
      console.error('[Material] 确认后序列化失败:', e.message);
      // ★ 确认已生效，序列化失败不应报为"确认失败"
      //   前端会通过 refreshFactFromServer 重试获取权威数据
      res.json(Res.success({
        affectedRows: frmResult.affectedRows,
        match_id: fact_rule_match_id,
        fact: null,
        _serialize_error: e.message,
      }, "已确认（数据刷新异常，请刷新页面查看）"));
    }
  } catch (e) {
    console.error('[Material] 确认失败:', e.message);
    res.json(Res.error("确认失败，请稍后重试"));
  }
};

// 删除材料（级联删除附件和识别结果）
exports.deleteMaterial = async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const { id } = req.params;
    await conn.beginTransaction();

    // 1. 查找关联的 analysis_runs
    const [runs] = await conn.execute(
      "SELECT id FROM material_analysis_runs WHERE material_id = ?", [id]
    );
    const runIds = runs.map(r => r.id);

    if (runIds.length > 0) {
      const ph = runIds.map(() => '?').join(',');

      // 2. 查找关联的 extracted_facts
      const [efs] = await conn.execute(
        `SELECT id FROM extracted_facts WHERE analysis_run_id IN (${ph})`, runIds
      );
      const efIds = efs.map(e => e.id);

      if (efIds.length > 0) {
        const eph = efIds.map(() => '?').join(',');

        // 3. 删除 fact_rule_matches（通过 extracted_fact_id）
        await conn.execute(
          `DELETE FROM fact_rule_matches WHERE extracted_fact_id IN (${eph})`, efIds
        );

        // 4. 删除 extracted_fact_sources
        await conn.execute(
          `DELETE FROM extracted_fact_sources WHERE extracted_fact_id IN (${eph})`, efIds
        );
      }

      // 5. 删除 extracted_facts
      await conn.execute(
        `DELETE FROM extracted_facts WHERE analysis_run_id IN (${ph})`, runIds
      );

      // 6. 删除 rule_match_runs（通过 analysis_run_id）
      await conn.execute(
        `DELETE FROM rule_match_runs WHERE analysis_run_id IN (${ph})`, runIds
      );
    }

    // 7. 删除 material_analysis_runs
    await conn.execute("DELETE FROM material_analysis_runs WHERE material_id = ?", [id]);

    // 8. 删除 material_recognitions（旧版表）
    await conn.execute("DELETE FROM material_recognitions WHERE material_id = ?", [id]);

    // 9. 删除 attachments
    await conn.execute("DELETE FROM attachments WHERE material_id = ?", [id]);

    // 10. 删除材料本身
    await conn.execute("DELETE FROM materials WHERE id = ? AND user_id = ?", [id, req.user.id]);

    await conn.commit();
    res.json(Res.success(null, "已删除"));
  } catch (e) {
    await conn.rollback();
    res.json(Res.error(e.message));
  } finally {
    conn.release();
  }
};

// 删除单个附件
// V3: confirm match + update F3 scoring + create fact_rule_matches for score list
exports.confirmMatchV3 = async (req, res) => {
  try {
    const { material_id, ef_id, item_key, score, description } = req.body;
    if (!ef_id) return res.json(Res.error("missing ef_id"));

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      // 1. Update extracted_facts
      await conn.execute(
        "UPDATE extracted_facts SET fact_data = JSON_SET(COALESCE(fact_data,'{}'), '$.match_score', ?, '$.match_desc', ?, '$.match_item_key', ?, '$.confirmed', true) WHERE id = ?",
        [score, description, item_key, ef_id]
      );

      // 2. Find analysis_run and rule_set for this fact
      const [efs] = await conn.execute(
        "SELECT e.analysis_run_id, m.user_id FROM extracted_facts e JOIN material_analysis_runs mar ON e.analysis_run_id = mar.id JOIN materials m ON mar.material_id = m.id WHERE e.id = ?",
        [ef_id]
      );
      if (!efs.length) { await conn.rollback(); conn.release(); return res.json(Res.error("fact not found")); }

      const { analysis_run_id, user_id } = efs[0];
      // ★ 按学生批次查询已发布规则集（不限制 user_id）
      const [btRows2] = await conn.execute(
        "SELECT id FROM assessment_batches WHERE college = (SELECT college FROM users WHERE id = ?) AND grade = (SELECT grade FROM users WHERE id = ?) AND status <> 'deleted' ORDER BY school_year DESC LIMIT 1",
        [user_id, user_id]
      );
      const matchBatchId = btRows2.length > 0 ? btRows2[0].id : null;
      const [rsRows] = await conn.execute(
        "SELECT id FROM rule_sets WHERE batch_id = ? AND status = 'published' ORDER BY published_at DESC LIMIT 1",
        [matchBatchId]
      );
      const ruleSetId = rsRows.length ? rsRows[0].id : 0;

      // 3. Find or create rule_match_runs
      let [rmrRows] = await conn.execute(
        "SELECT id FROM rule_match_runs WHERE rule_set_id = ? AND analysis_run_id = ? ORDER BY id DESC LIMIT 1",
        [ruleSetId, analysis_run_id]
      );
      let matchRunId;
      if (rmrRows.length) {
        matchRunId = rmrRows[0].id;
      } else {
        const [rmrInsert] = await conn.execute(
          "INSERT INTO rule_match_runs (rule_set_id, analysis_run_id, model_name, status, created_at, completed_at) VALUES (?, ?, 'v3_confirm', 'completed', NOW(), NOW())",
          [ruleSetId, analysis_run_id]
        );
        matchRunId = rmrInsert.insertId;
      }

      // 4. Build preview_data for score list display
      const previewData = JSON.stringify({
        score_preview: score,
        score_status: 'confirmed',
        indicator: { code: item_key || '', name: item_key || '' },
        rule: { name: description || '', rule_type: 'scoring' },
        human_readable: description || '',
      });

      // 5. Upsert fact_rule_matches (so getScoreList can read it)
      // ★ 修复重复加分: 先将同一 extracted_fact 的旧 is_current=1 记录全部置 0
      await conn.execute(
        "UPDATE fact_rule_matches SET is_current = 0 WHERE extracted_fact_id = ? AND is_current = 1",
        [ef_id]
      );
      const [existingFrm] = await conn.execute(
        "SELECT id FROM fact_rule_matches WHERE match_run_id = ? AND extracted_fact_id = ?",
        [matchRunId, ef_id]
      );
      if (existingFrm.length) {
        await conn.execute(
          "UPDATE fact_rule_matches SET review_status = 'confirmed', match_condition = 'pass', confidence = 1, is_current = 1, is_selected = 1, preview_data = ? WHERE id = ?",
          [previewData, existingFrm[0].id]
        );
      } else {
        await conn.execute(
          "INSERT INTO fact_rule_matches (match_run_id, extracted_fact_id, executable_rule_id, match_condition, confidence, review_status, is_current, is_selected, preview_data) VALUES (?, ?, 0, 'pass', 1, 'confirmed', 1, 1, ?)",
          [matchRunId, ef_id, previewData]
        );
      }

      // 6. smart_fill_data 不在确认时自动写入
      // 仅在用户点击"提交审核"时通过 saveFillData 写入（作为提交历史快照）

      await conn.commit();
      res.json(Res.success({ match_run_id: matchRunId }, "confirmed"));
    } catch (e) {
      await conn.rollback();
      res.json(Res.error(e.message));
    } finally {
      conn.release();
    }
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.deleteAttachment = async (req, res) => {
  try {
    const { matId, attId } = req.params;
    await pool.execute("DELETE FROM attachments WHERE id = ? AND material_id = ?", [attId, matId]);
    res.json(Res.success(null, "已删除"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// AI 生成加分描述
exports.generateMatchDescription = async (req, res) => {
  try {
    const { ef_id, indicator_code, score } = req.body;
    const [efs] = await pool.execute("SELECT * FROM extracted_facts WHERE id = ?", [ef_id]);
    if (!efs.length) return res.json(Res.error("fact not found"));
    const fd = typeof efs[0].fact_data === 'string' ? JSON.parse(efs[0].fact_data) : efs[0].fact_data;
    const [rules] = await pool.execute("SELECT * FROM scoring_rules WHERE item_key = ? AND status = 'active' LIMIT 1", [indicator_code]);
    const rule = rules[0] || { item_name: indicator_code };
    const { generateDescription } = require("../../services/zongce/ai/materialPipeline");
    const desc = await generateDescription(fd, rule, score);
    res.json(Res.success({ description: desc }, "ok"));
  } catch (e) { res.json(Res.error(e.message)); }
};
