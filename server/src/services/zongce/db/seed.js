const bcrypt = require("bcryptjs");

async function seedDevData(conn) {
  // ---- 系统配置（必须保留） ----

  // 评估等级规则
  await conn.execute(
    "INSERT IGNORE INTO assessment_settings (id, setting_key, setting_value) VALUES (1, 'grade_rules', ?)",
    [JSON.stringify([{ grade: '优', min: 85 }, { grade: '良', min: 75 }, { grade: '合格', min: 60 }, { grade: '不合格', min: 0 }])]
  );
  await conn.execute(
    "INSERT IGNORE INTO assessment_settings (id, setting_key, setting_value) VALUES (2, 'general', ?)",
    [JSON.stringify({ submitDeadline: '2026-07-25 23:59:59', allowStudentEdit: true, allowReturnEdit: true, requireReviewerComment: false, publishNotice: '请在截止时间前确认智能填表结果，并提交至班级测评小组。' })]
  );

  // 个性评定配置（权重 & 等级阈值）
  const formulaFWeights = { F1: 0.10, F2: 0.65, F3: 0.25 };
  const gradeLevels = [
    { min: 90, label: "优秀", color: "#059669", bg: "#ECFDF5" },
    { min: 80, label: "良好", color: "#4F46E5", bg: "#EEF2FF" },
    { min: 70, label: "中等", color: "#D97706", bg: "#FFFBEB" },
    { min: 60, label: "合格", color: "#DC2626", bg: "#FEF2F2" },
    { min: 0,  label: "待提升", color: "#9CA3AF", bg: "#F3F4F6" }
  ];
  await conn.execute(
    "INSERT IGNORE INTO evaluation_config (config_key, config_value, description) VALUES ('formula_f', ?, '综测总分权重 F=F1*w1+F2*w2+F3*w3')",
    [JSON.stringify(formulaFWeights)]
  );
  await conn.execute(
    "INSERT IGNORE INTO evaluation_config (config_key, config_value, description) VALUES ('grade_levels', ?, '等级阈值配置')",
    [JSON.stringify(gradeLevels)]
  );

  console.log("[DB] 种子完成: 系统配置已就绪，请通过注册页面创建新用户进行测试");
}

module.exports = { seedDevData };