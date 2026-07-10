/**
 * 综测自动填表引擎
 * - Word (.docx): docxtemplater + pizzip 占位符替换
 * - 开发期使用内置 MOCK_DATA 模拟前三个模块的输出
 */

const fs = require("fs");
const path = require("path");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

// ============================================================
// 模拟数据（开发期）
// ============================================================
const MOCK_DATA = {
  // === 基本信息 ===
  real_name: "张三",
  student_id: "2024001001",
  academic_year: "2024-2025",
  grade: "优",

  // === F1 基本素质（减分制，A1~A5 各 20 分基准分） ===
  F1_A1_score: 20,  F1_A1_base: 20,
  F1_A1_detail: "思想政治表现良好，全勤参加政治学习及形势与政策课",
  F1_A2_score: 18,  F1_A2_base: 20,
  F1_A2_detail: "道德品质良好，寝室卫生1次不合格扣2分",
  F1_A3_score: 20,  F1_A3_base: 20,
  F1_A3_detail: "学习态度端正，无旷课迟到早退记录",
  F1_A4_score: 20,  F1_A4_base: 20,
  F1_A4_detail: "严格遵守校纪校规，无任何违纪处分",
  F1_A5_score: 20,  F1_A5_base: 20,
  F1_A5_detail: "积极参加体育锻炼和班级活动，体测达标",
  F1_total: 98,  // A1+A2+A3+A4+A5 = 20+18+20+20+20
  F1_weighted: 9.8,  // F1×10%

  // === F2 课程学习成绩（加权平均分） ===
  F2_weighted_avg: 90.21,
  F2_weighted: 58.64,  // F2×65%
  F2_courses: [
    { name: "高等数学（上）",   credit: 5, score: 92 },
    { name: "大学英语（三）",   credit: 4, score: 88 },
    { name: "C语言程序设计",    credit: 4, score: 95 },
    { name: "大学物理（上）",   credit: 3, score: 85 },
    { name: "思想道德与法治",   credit: 2, score: 90 },
    { name: "数据结构",         credit: 4, score: 91 },
    { name: "线性代数",         credit: 3, score: 87 },
    { name: "马克思主义原理",   credit: 2, score: 86 },
    { name: "体育（1）",        credit: 1, score: 90 },
  ],

  // === F3 创新素质与实践能力（加分制，B1~B8） ===
  // B1 职业技能类
  F3_B1_score: 8.0,  F3_B1_max: 30,
  F3_B1_detail: "CET-6通过（+4分），国家计算机二级证书（+4分）",
  F3_B1_items: [
    { desc: "CET-6 通过", score: "4.0" },
    { desc: "国家计算机二级证书", score: "4.0" },
  ],

  // B2 科技学术类
  F3_B2_score: 18.0,  F3_B2_max: 30,
  F3_B2_detail: "全国大学生数学建模竞赛省级二等奖（+8分），SCI二区论文第二作者（+10分）",
  F3_B2_items: [
    { desc: "全国大学生数学建模竞赛二等奖（省级）", score: "8.0" },
    { desc: "SCI二区论文发表（第二作者）", score: "10.0" },
  ],

  // B3 社会工作类
  F3_B3_score: 6.0,  F3_B3_max: 30,
  F3_B3_detail: "院学生会学习部副部长（+4分），班级团支书（+2分）",
  F3_B3_items: [
    { desc: "院学生会学习部副部长", score: "4.0" },
    { desc: "班级团支书", score: "2.0" },
  ],

  // B4 宣传报道类
  F3_B4_score: 3.0,  F3_B4_max: 30,
  F3_B4_detail: "校报发表新闻稿2篇（+3分）",
  F3_B4_items: [
    { desc: "校报发表新闻稿2篇", score: "3.0" },
  ],

  // B5 文学艺术创作类
  F3_B5_score: 0,  F3_B5_max: 30,
  F3_B5_detail: "本学年无相关成果",
  F3_B5_items: [],

  // B6 文艺与体育竞赛类
  F3_B6_score: 8.0,  F3_B6_max: 30,
  F3_B6_detail: "校运会100米第二名（+5分），校园歌手大赛一等奖（+3分）",
  F3_B6_items: [
    { desc: "校运会100米第二名", score: "5.0" },
    { desc: "校园歌手大赛一等奖", score: "3.0" },
  ],

  // B7 其他实践活动类
  F3_B7_score: 7.5,  F3_B7_max: 30,
  F3_B7_detail: "青马小组组长（+3分），阳光长跑两学期完成（+3分），单词打卡270天以上（+1.5分）",
  F3_B7_items: [
    { desc: "青马小组组长", score: "3.0" },
    { desc: "阳光长跑两学期均完成", score: "3.0" },
    { desc: "英语单词/听力打卡270天以上", score: "1.5" },
  ],

  // B8 劳育类
  F3_B8_score: 6.3,  F3_B8_max: 30,
  F3_B8_detail: "暑期社会实践优秀团队（+3分），校级优秀寝室（+1分），教务办值班6次（+1.8分），社区劳动2次（+0.5分）",
  F3_B8_items: [
    { desc: "暑期社会实践优秀团队", score: "3.0" },
    { desc: "优秀寝室（校级）", score: "1.0" },
    { desc: "教务办值班（6次×0.3分）", score: "1.8" },
    { desc: "社区劳动活动（2次）", score: "0.5" },
  ],

  F3_total: 56.8,
  F3_weighted: 14.2,  // F3×25%

  // === 综测总分 ===
  // F = F1×10% + F2×65% + F3×25% = 9.8 + 58.64 + 14.2
  total_score: 82.64,
};

// ============================================================
// 填表引擎
// ============================================================

/**
 * 填充 Word (.docx) 模板
 * @param {string} templatePath - 模板文件路径
 * @param {object} data - 填充数据（默认使用 MOCK_DATA）
 * @returns {Buffer} 填充后的 docx 文件 buffer
 */
function fillDocx(templatePath, data = null) {
  const fillData = data || MOCK_DATA;

  // 读取模板文件
  const content = fs.readFileSync(templatePath);

  // ===== 预检查：扫描模板中是否有花括号占位符 =====
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

  // 配置 docxtemplater（默认分隔符就是 { }，不显式设置避免潜在冲突）
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  // 设置数据并渲染
  try {
    doc.render(fillData);
    console.log("[fillDocx] 渲染完成");
  } catch (e) {
    // 整理错误信息，方便调试
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

  // ===== 后检查：验证输出中是否还有未替换的占位符 =====
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
 * 获取填充数据（开发期返回 MOCK_DATA，上线后从数据库读取）
 */
function getFillData(userId = null) {
  // TODO: 上线后从 evaluation_results 表读取真实数据
  // const [rows] = await pool.execute("SELECT * FROM evaluation_results WHERE user_id = ?", [userId]);
  // if (rows.length > 0) return transformEvalToFillData(rows[0]);
  return { ...MOCK_DATA };
}

/**
 * 获取模拟数据（供前端预览）
 */
function getMockData() {
  return { ...MOCK_DATA };
}

module.exports = { fillDocx, getFillData, getMockData, MOCK_DATA };
