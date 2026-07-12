/**
 * 综测自动填表引擎
 * - Word (.docx): docxtemplater + pizzip 占位符替换
 * - 从数据库读取用户真实评定数据
 */

const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

// ============================================================
// 从数据库构建填表数据（替代硬编码 MOCK_DATA）
// ============================================================

/**
 * 从 assessment_forms + assessment_form_items + users 表中构建填表数据
 * @param {import('mysql2/promise').Pool} pool - 数据库连接池
 * @param {number} userId - 用户ID
 * @returns {object} 填表数据
 */
async function buildFillDataFromDB(pool, userId) {
  // 1) 查询用户基本信息
  const [users] = await pool.execute(
    "SELECT real_name, student_no, grade, college, major, class_name FROM users WHERE id = ?",
    [userId]
  );
  if (users.length === 0) {
    throw new Error("用户不存在");
  }
  const user = users[0];

  // 2) 查询最新 assessment_form
  const [forms] = await pool.execute(
    "SELECT * FROM assessment_forms WHERE student_id = ? ORDER BY id DESC LIMIT 1",
    [userId]
  );

  let scores = {};
  if (forms.length > 0) {
    const raw = forms[0].scores;
    scores = typeof raw === "string" ? JSON.parse(raw) : (raw || {});
  }

  // 3) 查询 assessment_form_items
  let items = [];
  if (forms.length > 0) {
    const [itemRows] = await pool.execute(
      "SELECT * FROM assessment_form_items WHERE form_id = ? ORDER BY sort_order ASC",
      [forms[0].id]
    );
    items = itemRows;
  }

  // 4) 查询课程成绩（从 evaluation_results.dimension_scores 中提取）
  let courses = [];
  if (forms.length > 0) {
    const [evalRows] = await pool.execute(
      "SELECT * FROM evaluation_results WHERE user_id = ? AND batch_id = ? ORDER BY id DESC LIMIT 1",
      [userId, forms[0].batch_id]
    );
    if (evalRows.length > 0) {
      const ds = evalRows[0].dimension_scores;
      const dimData = typeof ds === "string" ? JSON.parse(ds) : (ds || {});
      courses = dimData.courses || [];
    }
  }

  // 5) 构建与旧 MOCK_DATA 兼容的数据结构
  const f1 = scores.F1_details || {};
  const f3 = scores.F3_details || {};

  const F1_A1 = f1.A1 ?? 0;
  const F1_A2 = f1.A2 ?? 0;
  const F1_A3 = f1.A3 ?? 0;
  const F1_A4 = f1.A4 ?? 0;
  const F1_A5 = f1.A5 ?? 0;
  const F1_total = F1_A1 + F1_A2 + F1_A3 + F1_A4 + F1_A5;

  const F3_B1 = f3.B1 ?? 0;
  const F3_B2 = f3.B2 ?? 0;
  const F3_B3 = f3.B3 ?? 0;
  const F3_B4 = f3.B4 ?? 0;
  const F3_B5 = f3.B5 ?? 0;
  const F3_B6 = f3.B6 ?? 0;
  const F3_B7 = f3.B7 ?? 0;
  const F3_B8 = f3.B8 ?? 0;
  const F3_total = F3_B1 + F3_B2 + F3_B3 + F3_B4 + F3_B5 + F3_B6 + F3_B7 + F3_B8;

  // 从 items 中获取详情描述
  const itemMap = {};
  for (const it of items) {
    itemMap[it.sub_key] = { reason: it.reason || "", score: it.score || 0 };
  }

  function detail(key) {
    return itemMap[key]?.reason || "";
  }

  function itemList(key) {
    const i = itemMap[key];
    return i ? [{ desc: i.reason, score: String(i.score) }] : [];
  }

  const f2WeightedAvg = scores.f2_course_learning ?? (courses.length > 0
    ? (courses.reduce((s, c) => s + c.score * c.credit, 0) / courses.reduce((s, c) => s + c.credit, 0)).toFixed(2)
    : 0);

  const totalScore = scores.total
    ?? (F1_total * 0.1 + Number(f2WeightedAvg) * 0.65 + F3_total * 0.25).toFixed(2);

  const gradeLevels = [
    { min: 90, label: "优" },
    { min: 80, label: "良" },
    { min: 70, label: "中" },
    { min: 60, label: "合格" },
    { min: 0,  label: "待提升" },
  ];
  const gradeLabel = (gradeLevels.find(g => Number(totalScore) >= g.min) || gradeLevels[gradeLevels.length - 1]).label;

  return {
    // 基本信息
    real_name: user.real_name || "",
    student_id: user.student_no || "",
    academic_year: forms.length > 0 ? forms[0].batch_title || "" : "",
    grade: gradeLabel,

    // F1
    F1_A1_score: F1_A1, F1_A1_base: 20, F1_A1_detail: detail("A1"),
    F1_A2_score: F1_A2, F1_A2_base: 20, F1_A2_detail: detail("A2"),
    F1_A3_score: F1_A3, F1_A3_base: 20, F1_A3_detail: detail("A3"),
    F1_A4_score: F1_A4, F1_A4_base: 20, F1_A4_detail: detail("A4"),
    F1_A5_score: F1_A5, F1_A5_base: 20, F1_A5_detail: detail("A5"),
    F1_total,
    F1_weighted: parseFloat((F1_total * 0.1).toFixed(2)),

    // F2
    F2_weighted_avg: Number(f2WeightedAvg),
    F2_weighted: parseFloat((Number(f2WeightedAvg) * 0.65).toFixed(2)),
    F2_courses: courses.length > 0 ? courses : [],

    // F3
    F3_B1_score: F3_B1, F3_B1_max: 30, F3_B1_detail: detail("B1"), F3_B1_items: itemList("B1"),
    F3_B2_score: F3_B2, F3_B2_max: 30, F3_B2_detail: detail("B2"), F3_B2_items: itemList("B2"),
    F3_B3_score: F3_B3, F3_B3_max: 30, F3_B3_detail: detail("B3"), F3_B3_items: itemList("B3"),
    F3_B4_score: F3_B4, F3_B4_max: 30, F3_B4_detail: detail("B4"), F3_B4_items: itemList("B4"),
    F3_B5_score: F3_B5, F3_B5_max: 30, F3_B5_detail: detail("B5"), F3_B5_items: itemList("B5"),
    F3_B6_score: F3_B6, F3_B6_max: 30, F3_B6_detail: detail("B6"), F3_B6_items: itemList("B6"),
    F3_B7_score: F3_B7, F3_B7_max: 30, F3_B7_detail: detail("B7"), F3_B7_items: itemList("B7"),
    F3_B8_score: F3_B8, F3_B8_max: 30, F3_B8_detail: detail("B8"), F3_B8_items: itemList("B8"),
    F3_total,
    F3_weighted: parseFloat((F3_total * 0.25).toFixed(2)),

    // 总分
    total_score: Number(totalScore),
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
  if (!data) throw new Error("填表数据不能为空");

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
  const buffer = doc.getZip().generate({
    type: "nodebuffer",
    compression: "DEFLATE",
  });

  // 后检查：验证输出中是否还有未替换的占位符
  const outZip = new PizZip(buffer);
  try {
    const outXml = outZip.files["word/document.xml"].asText();
    const remaining = outXml.match(/\{[a-zA-Z_][a-zA-Z0-9_]*\}/g) || [];
    if (remaining.length > 0) {
      console.warn("[fillDocx] WARNING: 输出中仍有", remaining.length, "个未替换的标记:", [...new Set(remaining)].join(", "));
    } else {
      console.log("[fillDocx] 所有占位符已替换");
    }
  } catch (e) { /* 忽略 */ }

  return buffer;
}

/**
 * 获取填表数据（从数据库读取）
 * @param {import('mysql2/promise').Pool} pool - 数据库连接池
 * @param {number} userId - 用户ID
 */
async function getFillData(pool, userId) {
  if (!userId) throw new Error("用户ID不能为空");
  return buildFillDataFromDB(pool, userId);
}

/**
 * 获取模拟数据（从数据库读取，供前端预览）
 * @param {import('mysql2/promise').Pool} pool - 数据库连接池
 * @param {number} userId - 用户ID
 */
async function getMockData(pool, userId) {
  if (!userId) throw new Error("用户ID不能为空");
  return buildFillDataFromDB(pool, userId);
}

module.exports = { fillDocx, getFillData, getMockData };
