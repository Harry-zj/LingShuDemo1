const { pool } = require("../../../config/database");
const { extractFacts } = require("./factExtractor");
const { matchFactsToRules } = require("./ruleMatcher");
const crypto = require("crypto");

// ============================================================
//  两阶段分析 + 事务写入
//    Phase 1: 合并所有附件 → 提取事实（不取最高）
//    Phase 2: 统一事实 + 规则 → 匹配（代码算置信度）
// ============================================================
async function analyzeMaterial(materialId, userId) {
  const [mats] = await pool.execute(
    "SELECT * FROM materials WHERE id = ? AND user_id = ?", [materialId, userId]
  );
  if (!mats.length) throw new Error("材料不存在");

  const [attachments] = await pool.execute(
    "SELECT * FROM attachments WHERE material_id = ?", [materialId]
  );
  if (!attachments.length) throw new Error("请先上传证明文件");

  const [ruleItems] = await pool.execute(
    "SELECT * FROM rule_items WHERE user_id = ? AND status = 'confirmed'", [userId]
  );
  if (!ruleItems.length) throw new Error("请先确认至少一条规则");

  // ★ 生成输入哈希（用于追溯）
  const inputHash = crypto.createHash("sha256")
    .update(attachments.map((a) => a.file_path + a.file_size).join("|"))
    .digest("hex").slice(0, 16);

  // ===== Phase 1: 合并提取事实（所有附件一起分析） =====
  const factResult = await extractFacts(attachments);

  // 更新附件 ai_label
  for (const att of attachments) {
    const factsFromThis = factResult.facts.filter((f) => f.attachment_id === att.id);
    const label = factsFromThis.length > 0
      ? factsFromThis.map((f) => `${f.type}:${f.value}`).slice(0, 3).join("|")
      : "无法提取";
    await pool.execute("UPDATE attachments SET ai_label = ? WHERE id = ?", [label.slice(0, 100), att.id]);
  }

  // ===== Phase 2: 统一匹配规则 =====
  const matchResult = await matchFactsToRules(factResult.facts, ruleItems, userId);

  // ===== ★ 事务写入 =====
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute("DELETE FROM material_recognitions WHERE material_id = ?", [materialId]);

    const bestConfidence = matchResult.candidates.length > 0
      ? matchResult.candidates[0].final_confidence
      : 0;

    const [rec] = await conn.execute(
      `INSERT INTO material_recognitions
       (material_id, category, explanation, confidence, matched_rule_ids, confirm_status, raw_ai_response)
       VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
      [
        materialId,
        matchResult.final_category,
        matchResult.explanation,
        bestConfidence,
        JSON.stringify(
          matchResult.candidates
            .filter((c) => c.condition === "pass")
            .map((c) => c.rule_id)
        ),
        JSON.stringify({
          input_hash: inputHash,
          fact_result: {
            facts: factResult.facts,
            overall_clarity: factResult.overall_clarity,
            missing_info: factResult.missing_info,
            input_hash: factResult.input_hash,
          },
          match_result: {
            candidates: matchResult.candidates,
            final_category: matchResult.final_category,
            prompt_version: matchResult.prompt_version,
            model: matchResult.model,
            raw: matchResult.raw_match_result,
          },
        }),
      ]
    );

    if (matchResult.final_category) {
      await conn.execute("UPDATE materials SET category = ? WHERE id = ?", [matchResult.final_category, materialId]);
    }

    await conn.commit();
    return {
      recognitionId: rec.insertId,
      category: matchResult.final_category,
      confidence: bestConfidence,
      explanation: matchResult.explanation,
      facts_count: factResult.facts.length,
      candidates_count: matchResult.candidates.length,
      input_hash: inputHash,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { analyzeMaterial };
