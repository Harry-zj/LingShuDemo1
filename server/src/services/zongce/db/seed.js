/**
 * 开发环境种子数据 - 由 database.js 调用
 */
const bcrypt = require("bcryptjs");

async function seedDevData(conn) {
  const pwd = await bcrypt.hash("123456", 10);
  // 测试用户
  await conn.execute("INSERT IGNORE INTO users (id, username, password, role, real_name) VALUES (2, 'zhangsan', ?, 'student', '张三')", [pwd]);
  // 测试模板
  await conn.execute("INSERT IGNORE INTO fill_templates (id, user_id, name, file_path, template_type) VALUES (1, 2, '综测登记表模板.docx', '测试模板_综测登记表.docx', 'docx')");

  // 模板字段映射
  const maps = require("./seed-mappings.json");
  const evalData = require("./seed-evaluation.json");

  const sql = "INSERT IGNORE INTO fill_template_mappings (id, template_id, placeholder, field_label, data_path, field_type, format, sort_order) VALUES (?,?,?,?,?,?,?,?)";
  for (const m of maps) { try { await conn.execute(sql, m); } catch (e) {} }

  // 评分结果
  await conn.execute(
    "INSERT IGNORE INTO evaluation_results (id, user_id, total_score, grade, formula, dimension_scores) VALUES (1, 2, 82.64, '优', 'F1*10%+F2*65%+F3*25%', ?)",
    [JSON.stringify(evalData)]
  );

  console.log("[DB] 种子完成: 用户(dev,zhangsan) 映射(" + maps.length + "条) 评分(1条)");
}

module.exports = { seedDevData };
