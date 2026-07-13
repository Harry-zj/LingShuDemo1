/**
 * 综测自动填表引擎
 * - Word (.docx): docxtemplater + pizzip 占位符替换
 * - 从数据库读取当前用户的评分数据构建填充数据
 */

const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const { pool } = require("../../config/database");

// ============================================================
// 数据构建辅助
// ============================================================

// ★ 将 B1-B8 映射到 F3 子项字段名
const B_TO_F3_MAP = {
  B1: 'F3_B1', B2: 'F3_B2', B3: 'F3_B3', B4: 'F3_B4',
  B5: 'F3_B5', B6: 'F3_B6', B7: 'F3_B7', B8: 'F3_B8',
};

/** 从 indicator 的 code / canonical_key / name 推断填表映射组 */
function resolveIndicatorGroup(code, canonicalKey, name) {
  const ck = (canonicalKey || '').toLowerCase();
  const nm = (name || '');

  // F1
  if (code === 'F1' || code === 'F' || code?.startsWith('F1.') || ck.startsWith('basic_quality') || ck.startsWith('moral') || nm.includes('基本素质') || nm.includes('思想品德')) return 'F1';
  // F2
  if (code === 'F2' || code?.startsWith('F2.') || ck.startsWith('course') || ck.startsWith('academic') || nm.includes('课程学习') || nm.includes('学习成绩')) return 'F2';
  // F3 → 子项 B1-B8
  if (code === 'F3' || code === 'B' || code?.startsWith('F3.') || ck.startsWith('innovation') || ck.startsWith('practice') || nm.includes('创新') || nm.includes('实践')) {
    // 检查是否有明确的子 code 如 B1, B3 等
    if (code && /^B\d+$/.test(code)) return code; // B1 → B1
    return 'F3';
  }
  // 直接 B1-B8
  if (code && /^B\d+$/.test(code)) return code;
  // 其他：尝试从 canonical_key 推断
  if (ck.includes('skill') || ck.includes('cert')) return 'B1';
  if (ck.includes('competition') || ck.includes('academic_competition')) return 'B2';
  if (ck.includes('tech') || ck.includes('sci')) return 'B3';
  if (ck.includes('literary') || ck.includes('art') || ck.includes('culture')) return 'B4';
  if (ck.includes('social_work') || ck.includes('cadre')) return 'B5';
  if (ck.includes('social_practice') || ck.includes('social')) return 'B6';
  if (ck.includes('sport') || ck.includes('cultural_sport')) return 'B7';
  if (ck.includes('labor')) return 'B8';

  return null; // 无法归类
}
function buildF3Defaults() {
  const keys = ["B1", "B2", "B3", "B4", "B5", "B6", "B7", "B8"];
  const obj = {};
  for (const k of keys) {
    obj["F3_" + k + "_score"] = 0;
    obj["F3_" + k + "_max"] = 30;
    obj["F3_" + k + "_detail"] = "";
    obj["F3_" + k + "_items"] = [];
  }
  return obj;
}

/**
 * 从数据库获取用户填表数据
 * @param {number} userId - 用户ID
 * @returns {object} 填充数据
 */
async function getFillData(userId, batchId) {
  const conn = await pool.getConnection();
  try {
    // 1. 查询用户信息
    const [users] = await conn.execute(
      "SELECT id, real_name, student_no, grade, major, college, class_name FROM users WHERE id = ?", [userId]
    );
    if (!users.length) {
      console.warn("[fillService] 用户不存在 userId=" + userId);
      return buildDefaultFillData();
    }
    const user = users[0];

    // 2. 查询已发布的规则集
    const [ruleSets] = await conn.execute(
      "SELECT id FROM rule_sets WHERE user_id = ? AND status = 'published' AND (? IS NULL OR batch_id = ?) ORDER BY published_at DESC LIMIT 1",
      [userId, batchId || null, batchId || null]
    );

    // 3. 构建基础数据
    const fillData = {
      real_name: user.real_name || user.username || "",
      student_id: user.student_no || "",
      academic_year: "2025-2026",
      grade: "",
      college: user.college || "",
      major: user.major || "",
      class_name: user.class_name || "",
      grade_name: user.grade || "",

      // F1 基本素质（默认满分）
      F1_total: 100, F1_weighted: 10,
      F1_A1_score: 20, F1_A1_base: 20, F1_A1_detail: "",
      F1_A2_score: 20, F1_A2_base: 20, F1_A2_detail: "",
      F1_A3_score: 20, F1_A3_base: 20, F1_A3_detail: "",
      F1_A4_score: 20, F1_A4_base: 20, F1_A4_detail: "",
      F1_A5_score: 20, F1_A5_base: 20, F1_A5_detail: "",

      // F2 课程学习
      F2_weighted_avg: 0, F2_weighted: 0, F2_courses: [],

      // F3 创新实践
      F3_total: 0, F3_weighted: 0,
      ...buildF3Defaults(),

      total_score: 0,
    };

    if (!ruleSets.length) {
      console.log("[fillService] 无已发布规则集，返回基础用户数据");
      return fillData;
    }
    const ruleSetId = ruleSets[0].id;

    // 4. 查询已确认的事实匹配（V3: 不再依赖 indicator_nodes）
    const [rows] = await conn.execute(
      `SELECT m.id AS material_id, m.title AS material_title,
        ef.id AS fact_id, ef.fact_data, ef.fact_type,
        frm.preview_data, frm.review_status
       FROM fact_rule_matches frm
       JOIN extracted_facts ef ON frm.extracted_fact_id = ef.id
       JOIN material_analysis_runs mar ON ef.analysis_run_id = mar.id
       JOIN materials m ON mar.material_id = m.id
       JOIN rule_match_runs rmr ON frm.match_run_id = rmr.id
       WHERE frm.review_status = 'confirmed'
         AND frm.is_current = 1 AND frm.is_selected = 1
         AND m.user_id = ?
       ORDER BY m.id, ef.id`,
      [userId]
    );

    console.log(`[fillService] 查询到 ${rows.length} 条已确认事实匹配`);

    // 5. 按指标分组聚合分数（使用 resolveIndicatorGroup 智能映射）
    const groupMap = new Map();

    for (const row of rows) {
      try {
        preview = typeof row.preview_data === 'string'
          ? JSON.parse(row.preview_data) : (row.preview_data || {});
      } catch (_) {}

      const factData = typeof row.fact_data === 'string'
        ? JSON.parse(row.fact_data) : (row.fact_data || {});

      // ★ 从 preview_data 中获取 indicator 信息
      const previewCode = preview.indicator?.code || preview.indicator_code || '';
      const previewCKey = preview.indicator?.canonical_key || '';
      const previewName = preview.indicator?.name || preview.indicator_name || '';
      const score = preview.score_preview ?? 0;

      // ★ 用智能映射判断属于哪个组
      let groupKey = resolveIndicatorGroup(previewCode, previewCKey, previewName);

      // 如果 preview 里没有 indicator 信息，尝试从 fact_type 和 fact_data 推断
      if (!groupKey) {
        groupKey = resolveIndicatorGroup(null, null, factData.award_name || row.fact_type || '');
      }

      // 兜底：归入 F3
      if (!groupKey) {
        groupKey = 'F3';
        console.warn(`[fillService] 无法归类 fact_id=${row.fact_id}, 归入F3`);
      }

      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, { facts: [], totalScore: 0 });
      }
      const group = groupMap.get(groupKey);
      group.facts.push({
        human_readable: preview.human_readable || '',
        fact_id: row.fact_id,
        fact_type: row.fact_type,
        award_name: factData.value || factData.award_name || '',
        competition_name: factData.value || factData.competition_name || '',
        inferred_level: factData.inferred_level || '',
        award_rank: factData.award_rank || '',
        score: score,
        source_file: row.source_file || '',
      });
      group.totalScore += score;
    }

    console.log(`[fillService] 分组结果: ${[...groupMap.keys()].map(k => `${k}(${groupMap.get(k).totalScore}分)`).join(', ')}`);

    // 7. 映射到填表数据
    let f1Total = 0, f2Total = 0, f3Total = 0;

    for (const [groupKey, group] of groupMap) {
      

      if (groupKey === 'F1') {
        f1Total += group.totalScore;
      } else if (groupKey === 'F2') {
        f2Total += group.totalScore;
        fillData.F2_weighted_avg = group.totalScore;
      } else if (groupKey.startsWith('B')) {
        // B1-B8 → F3 子项
        f3Total += group.totalScore;
        const bKey = groupKey; // B1, B2, ...
        if (B_TO_F3_MAP[bKey]) {
          const f3Key = B_TO_F3_MAP[bKey]; // F3_B1, ...
          fillData[f3Key + '_score'] = group.totalScore;
          // _detail 在 step8c 中统一处理（优先 smart_fill_data，否则从 _items 自动生成）
          fillData[f3Key + '_items'] = group.facts.map(f => ({
            desc: f.human_readable || f.competition_name || f.award_name || '未知',
            score: String(f.score),
          }));
        }
      } else if (groupKey === 'F3') {
        f3Total += group.totalScore;
      }
    }

    fillData.F1_total = f1Total;
    fillData.F3_total = f3Total;

    // ★ 8. 从 smart_fill_data 读取用户保存的分数和描述（兼容 rule_set_id=0 的情况）
    // 注意：smart_fill_data 表没有 batch_id 列，通过 rule_set_id 关联到批次
    const [savedRows] = await conn.execute(
      "SELECT * FROM smart_fill_data WHERE user_id = ? AND (rule_set_id = ? OR rule_set_id = 0)",
      [userId, ruleSetId || 0]
    );

    // 构建 lookup: "section:item_key" → row
    const savedMap = new Map();
    for (const sr of savedRows) {
      savedMap.set(`${sr.section}:${sr.item_key}`, sr);
    }

    // 8a. 合并 F1 数据：优先用户保存的，否则用默认满分
    const F1_KEYS = ['A1','A2','A3','A4','A5'];
    const F1_NAMES = ['思想政治表现','道德品质修养','学习态度作风','组织纪律观念','身心健康素质'];
    for (let i = 0; i < F1_KEYS.length; i++) {
      const key = F1_KEYS[i];
      const saved = savedMap.get(`F1:${key}`);
      const scoreKey = `F1_${key}_score`;
      const detailKey = `F1_${key}_detail`;
      if (saved) {
        fillData[scoreKey] = Math.max(0, 20 - (Number(saved.score) || 0));
        fillData[detailKey] = saved.description || '';
      } else {
        // 默认满分，描述为空（前端可 AI 生成）
        fillData[scoreKey] = 20;
        fillData[detailKey] = '';
      }
    }

    // 8b. 合并 F2 数据：课程列表
    const savedF2 = savedMap.get('F2:COURSE');
    if (savedF2 && savedF2.extra_data) {
      try {
        const courses = typeof savedF2.extra_data === 'string'
          ? JSON.parse(savedF2.extra_data) : savedF2.extra_data;
        fillData.F2_courses = courses || [];
        // 计算加权平均分
        let weightedSum = 0, totalCredits = 0;
        for (const c of fillData.F2_courses) {
          weightedSum += (c.score || 0) * (c.credit || 0);
          totalCredits += (c.credit || 0);
        }
        fillData.F2_weighted_avg = totalCredits > 0 ? Math.round(weightedSum / totalCredits * 100) / 100 : 0;
        f2Total = fillData.F2_weighted_avg;
      } catch (_) {}
    }

    // 8c. 合并 F3 数据：分数从材料识别来，描述优先用户保存的，否则自动生成
    const B_KEYS = ['B1','B2','B3','B4','B5','B6','B7','B8'];
    for (const bKey of B_KEYS) {
      const saved = savedMap.get(`F3:${bKey}`);
      const f3Key = B_TO_F3_MAP[bKey];
      if (!f3Key) continue;

      const scoreKey = f3Key + '_score';
      const detailKey = f3Key + '_detail';

      // 描述：优先用户保存的 > 材料自动生成的 > 空
      if (saved && saved.description) {
        fillData[detailKey] = saved.description;
      } else if (!fillData[detailKey] && fillData[scoreKey] > 0) {
        // 自动生成描述
        fillData[detailKey] = fillData[f3Key + '_items']
          ?.map(it => it.desc + '(+' + it.score + '分)')
          .filter(Boolean).join('；') || '';
      }

      // 分数：用户可覆盖材料分数
      if (saved && saved.score !== null && saved.score !== undefined) {
        fillData[scoreKey] = Number(saved.score);
      }
    }

    // 重新算 F3 总分
    fillData.F3_total = B_KEYS.reduce((s, k) => s + (fillData[B_TO_F3_MAP[k] + '_score'] || 0), 0);
    fillData.total_score = Math.round((f1Total * 0.1 + f2Total * 0.65 + fillData.F3_total * 0.25) * 100) / 100;

    // 计算加权
    fillData.F1_weighted = Math.round(f1Total * 0.1 * 100) / 100;
    fillData.F2_weighted = Math.round(f2Total * 0.65 * 100) / 100;
    fillData.F3_weighted = Math.round(fillData.F3_total * 0.25 * 100) / 100;

    // 等级
    if (fillData.total_score >= 90) fillData.grade = "优秀";
    else if (fillData.total_score >= 80) fillData.grade = "良好";
    else if (fillData.total_score >= 70) fillData.grade = "中等";
    else if (fillData.total_score >= 60) fillData.grade = "合格";
    else fillData.grade = "待提升";

    console.log(`[fillService] 构建填表数据完成: userId=${userId} totalScore=${fillData.total_score} facts=${rows.length}`);
    return fillData;

  } finally {
    conn.release();
  }
}

/** 构建默认填表数据（无用户时fallback） */
function buildDefaultFillData() {
  return {
    real_name: '', student_id: '', academic_year: '2025-2026', grade: '',
    college: '', major: '', class_name: '', grade_name: '',
    F1_total: 0, F1_weighted: 0,
    F1_A1_score: 0, F1_A1_base: 20, F1_A1_detail: '',
    F1_A2_score: 0, F1_A2_base: 20, F1_A2_detail: '',
    F1_A3_score: 0, F1_A3_base: 20, F1_A3_detail: '',
    F1_A4_score: 0, F1_A4_base: 20, F1_A4_detail: '',
    F1_A5_score: 0, F1_A5_base: 20, F1_A5_detail: '',
    F2_weighted_avg: 0, F2_weighted: 0, F2_courses: [],
    F3_total: 0, F3_weighted: 0,
    ...buildF3Defaults(),
    total_score: 0,
  };
}

// ============================================================
// 填表引擎
// ============================================================

/**
 * 填充 Word (.docx) 模板
 * @param {string} templatePath - 模板文件路径
 * @param {object} data - 填充数据
 * @returns {Buffer} 填充后的 docx 文件 buffer
 */
function fillDocx(templatePath, data) {
  if (!data) throw new Error("缺少填充数据");

  // 读取模板文件
  const content = fs.readFileSync(templatePath);

  // 预检查：扫描模板中是否有花括号占位符
  const text = content.toString("utf-8");
  const braceMatches = text.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g) || [];
  console.log("[fillDocx] 模板中检测到花括号标记:", braceMatches.length, "个");
  if (braceMatches.length > 0) {
    console.log("[fillDocx] 标记列表:", [...new Set(braceMatches)].slice(0, 20).join(", "));
  }

  // 用 pizzip 加载 docx（本质是 zip）
  const zip = new PizZip(content);

  // 查看 document.xml 中的标签情况
  try {
    const docXml = zip.files["word/document.xml"].asText();
    const xmlBraces = docXml.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g) || [];
    console.log("[fillDocx] document.xml 中检测到标记:", xmlBraces.length, "个");
    if (xmlBraces.length > 0) {
      console.log("[fillDocx] XML标记:", [...new Set(xmlBraces)].slice(0, 20).join(", "));
    } else {
      console.warn("[fillDocx] WARNING: document.xml 中未检测到任何 {tag} 占位符！");
      console.warn("[fillDocx] 请确保模板中使用了 {real_name} {student_id} 等占位符格式");
    }
  } catch (e) {
    console.warn("[fillDocx] 无法解析 document.xml:", e.message);
  }

  // 配置 docxtemplater
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  // 设置数据并渲染
  try {
    doc.render(data);
    console.log("[fillDocx] 渲染完成");
  } catch (e) {
    const errMsg = e.properties?.errors
      ? e.properties.errors.map((err) => "占位符 \"" + err.tag + "\" 替换失败: " + (err.explanation || err.message)).join("；")
      : e.message;
    throw new Error("模板渲染失败: " + errMsg);
  }

  // 生成 buffer
  return doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });
}

/**
 * 获取填充数据预览（供前端）
 */
async function getFillDataPreview(userId, batchId) {
  return await getFillData(userId, batchId);
}

module.exports = { fillDocx, getFillData, getFillDataPreview };
