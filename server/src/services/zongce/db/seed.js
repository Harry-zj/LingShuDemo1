const bcrypt = require("bcryptjs");

async function seedDevData(conn) {
  const pwd = await bcrypt.hash("123456", 10);

  // ---- 只保留测试学生：张三 ----
  await conn.execute(
    "INSERT IGNORE INTO users (id, username, password, role, real_name, student_no, class_id, class_name, college, major, grade) VALUES (2, 'zhangsan', ?, 'student', '张三', '2024001001', 1, '计科2401班', '信息科学与工程学院', '计算机科学与技术', '2024级')",
    [pwd]
  );

  // 测试模板
  await conn.execute(
    "INSERT IGNORE INTO fill_templates (id, user_id, name, file_path, template_type) VALUES (1, 2, '综测登记表模板.docx', '测试模板_综测登记表.docx', 'docx')"
  );

  // 模板字段映射（保留，供后续AI模板分析参考）
  const maps = require("./seed-mappings.json");
  const mapSQL = "INSERT IGNORE INTO fill_template_mappings (id, template_id, placeholder, field_label, data_path, field_type, format, sort_order) VALUES (?,?,?,?,?,?,?,?)";
  for (const m of maps) {
    try { await conn.execute(mapSQL, m); } catch (e) {}
  }

  // ---- 评分结果（张三，与 fillService MOCK_DATA 一致） ----
  const evalData = require("./seed-evaluation.json");
  await conn.execute(
    "INSERT IGNORE INTO evaluation_results (id, user_id, total_score, grade, formula, dimension_scores) VALUES (1, 2, 82.64, '优', 'F1*10%+F2*65%+F3*25%', ?)",
    [JSON.stringify(evalData)]
  );

  // ---- 评估批次 ----
  await conn.execute(
    "INSERT IGNORE INTO assessment_batches (id, title, description, start_time, end_time, requirements, status, created_by, creator_name, options) VALUES (101, '2025-2026学年本科学生综合素质测评', '学生上传支撑材料后，由智能填表模块生成综测评价表结果。', '2026-07-01 08:00:00', '2026-07-25 23:59:59', '评价表结果由智能填表模块生成，三类评价主体依次评价。', 'published', 2, '张三', ?)",
    [JSON.stringify({ allowStudentEdit: true, allowReturnEdit: true, requireReviewerComment: false })]
  );

  // ---- 评估表单（张三，scores结构与MOCK_DATA对齐） ----
  const zhangsanScores = {
    f1_basic_quality: 98,
    f2_course_learning: 90.21,
    f3_innovation_practice: 56.8,
    total: 82.64,
    F1_details: { A1: 20, A2: 18, A3: 20, A4: 20, A5: 20 },
    F3_details: { B1: 8.0, B2: 18.0, B3: 6.0, B4: 3.0, B5: 0, B6: 8.0, B7: 7.5, B8: 6.3 }
  };
  await conn.execute(
    "INSERT IGNORE INTO assessment_forms (id, batch_id, batch_title, student_id, student_name, student_no, college, major, grade, class_id, class_name, from_smart_fill, status, level, scores, personal_summary) VALUES (201, 101, '2025-2026学年本科学生综合素质测评', 2, '张三', '2024001001', '信息科学与工程学院', '计算机科学与技术', '2024级', 1, '计科2401班', 1, 'smart_ready', '优', ?, ?)",
    [JSON.stringify(zhangsanScores), '该数据由智能填表模块根据学生上传材料和规则自动生成。']
  );

  // ---- 评估表加分项（14条，与MOCK_DATA完全一致） ----
  const items = [
    [301, 201, 'F1', 'A1', '思想政治表现A1', '思想政治表现良好，全勤参加政治学习', 20, '[501]', 1, 1],
    [302, 201, 'F1', 'A2', '道德品质修养A2', '道德品质良好，寝室卫生1次不合格扣2分', 18, '[]', 1, 2],
    [303, 201, 'F1', 'A3', '学习态度作风A3', '学习态度端正，无旷课迟到早退记录', 20, '[]', 1, 3],
    [304, 201, 'F1', 'A4', '组织纪律观念A4', '严格遵守校纪校规，无任何违纪处分', 20, '[]', 1, 4],
    [305, 201, 'F1', 'A5', '身心健康素质A5', '积极参加体育锻炼和班级活动，体测达标', 20, '[]', 1, 5],
    [306, 201, 'F2', 'COURSE', '课程学习成绩', '9门课程加权平均分90.21', 90.21, '[502]', 1, 6],
    [307, 201, 'F3', 'B1', '职业技能类B1', 'CET-6通过(+4分)，计算机二级证书(+4分)', 8.0, '[503]', 1, 7],
    [308, 201, 'F3', 'B2', '科技学术类B2', '数学建模省级二等奖(+8分)，SCI论文第二作者(+10分)', 18.0, '[]', 1, 8],
    [309, 201, 'F3', 'B3', '社会工作类B3', '院学生会副部长(+4分)，班级团支书(+2分)', 6.0, '[]', 1, 9],
    [310, 201, 'F3', 'B4', '宣传报道类B4', '校报发表新闻稿2篇(+3分)', 3.0, '[]', 1, 10],
    [311, 201, 'F3', 'B5', '文艺创作类B5', '本学年无相关成果', 0, '[]', 1, 11],
    [312, 201, 'F3', 'B6', '文体竞赛类B6', '校运会100米第二名(+5分)，校园歌手大赛一等奖(+3分)', 8.0, '[]', 1, 12],
    [313, 201, 'F3', 'B7', '其他实践类B7', '青马小组组长(+3分)，阳光长跑完成(+3分)，单词打卡(+1.5分)', 7.5, '[]', 1, 13],
    [314, 201, 'F3', 'B8', '劳育类B8', '暑期社会实践优秀团队(+3分)，优秀寝室(+1分)，值班6次(+1.8分)，社区劳动(+0.5分)', 6.3, '[]', 1, 14],
  ];
  const itemSQL = 'INSERT IGNORE INTO assessment_form_items (id, form_id, section, sub_key, title, reason, score, evidence_ids, editable, sort_order) VALUES (?,?,?,?,?,?,?,?,?,?)';
  for (const it of items) {
    try { await conn.execute(itemSQL, it); } catch (e) {}
  }

  // ---- 系统设置 ----
  await conn.execute(
    "INSERT IGNORE INTO assessment_settings (id, setting_key, setting_value) VALUES (1, 'grade_rules', ?)",
    [JSON.stringify([{ grade: '优', min: 85 }, { grade: '良', min: 75 }, { grade: '合格', min: 60 }, { grade: '不合格', min: 0 }])]
  );
  await conn.execute(
    "INSERT IGNORE INTO assessment_settings (id, setting_key, setting_value) VALUES (2, 'general', ?)",
    [JSON.stringify({ submitDeadline: '2026-07-25 23:59:59', allowStudentEdit: true, allowReturnEdit: true, requireReviewerComment: false, publishNotice: '请在截止时间前确认智能填表结果，并提交至班级测评小组。' })]
  );

  console.log("[DB] 种子完成: 用户(zhangsan) 映射(" + maps.length + "条) 评分(1条) 表单(1条) 条目(14条)");
}

module.exports = { seedDevData };