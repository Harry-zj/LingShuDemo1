const fs = require("fs");
const path = require("path");
const { pool } = require("../../config/database");
const { getFillDataPreview } = require("../zongce/fillService");

const ROLE_LABEL = {
  student: "学生",
  counselor: "辅导员",
  student_affairs: "学生工作处",
  admin: "管理员",
};

const STATUS_LABEL = {
  smart_ready: "智能填表待提交",
  pending_class_committee: "待评价小组评价",
  returned_by_class_committee: "评价小组退回",
  pending_counselor: "待辅导员评价",
  returned_by_counselor: "辅导员退回",
  pending_student_affairs: "待学生工作处评价",
  returned_by_student_affairs: "学生工作处退回",
  approved: "认定通过",
  rejected: "不予认定",
  pending_objection_review: "待评价小组异议复评",
};

const FORM_STRUCTURE = [
  {
    key: "F1",
    title: "F1 基本素质评分",
    weight: "10%",
    scoreKey: "f1_basic_quality",
    children: [
      { key: "A1", title: "思想政治表现A1" },
      { key: "A2", title: "道德品质修养A2" },
      { key: "A3", title: "学习态度作风A3" },
      { key: "A4", title: "组织纪律观念A4" },
      { key: "A5", title: "身心健康素质A5" },
    ],
  },
  {
    key: "F2",
    title: "F2 课程学习成绩评分",
    weight: "65%",
    scoreKey: "f2_course_learning",
    children: [{ key: "COURSE", title: "课程成绩" }],
  },
  {
    key: "F3",
    title: "F3 创新素质与实践能力评分",
    weight: "25%",
    scoreKey: "f3_innovation_practice",
    children: [
      { key: "B1", title: "职业技能类B1" },
      { key: "B2", title: "学科竞赛类B2" },
      { key: "B3", title: "科研学术活动类B3" },
      { key: "B4", title: "文学艺术创作与宣传报道类B4" },
      { key: "B5", title: "社会工作类B5" },
      { key: "B6", title: "社会实践类B6" },
      { key: "B7", title: "文体艺术活动类B7" },
      { key: "B8", title: "劳育类B8" },
    ],
  },
];

const SMART_FILL_ITEM_DEFINITIONS = [
  { section: "F1", subKey: "A1", title: "思想政治表现", scoreKey: "F1_A1_score", detailKey: "F1_A1_detail" },
  { section: "F1", subKey: "A2", title: "道德品质修养", scoreKey: "F1_A2_score", detailKey: "F1_A2_detail" },
  { section: "F1", subKey: "A3", title: "学习态度作风", scoreKey: "F1_A3_score", detailKey: "F1_A3_detail" },
  { section: "F1", subKey: "A4", title: "组织纪律观念", scoreKey: "F1_A4_score", detailKey: "F1_A4_detail" },
  { section: "F1", subKey: "A5", title: "身心健康素质", scoreKey: "F1_A5_score", detailKey: "F1_A5_detail" },
  { section: "F2", subKey: "COURSE", title: "课程学习成绩", scoreKey: "F2_weighted_avg", detailKey: "F2_courses" },
  { section: "F3", subKey: "B1", title: "职业技能类", scoreKey: "F3_B1_score", detailKey: "F3_B1_detail" },
  { section: "F3", subKey: "B2", title: "学科竞赛类", scoreKey: "F3_B2_score", detailKey: "F3_B2_detail" },
  { section: "F3", subKey: "B3", title: "科研学术活动类", scoreKey: "F3_B3_score", detailKey: "F3_B3_detail" },
  { section: "F3", subKey: "B4", title: "文学艺术创作与宣传报道类", scoreKey: "F3_B4_score", detailKey: "F3_B4_detail" },
  { section: "F3", subKey: "B5", title: "社会工作类", scoreKey: "F3_B5_score", detailKey: "F3_B5_detail" },
  { section: "F3", subKey: "B6", title: "社会实践类", scoreKey: "F3_B6_score", detailKey: "F3_B6_detail" },
  { section: "F3", subKey: "B7", title: "文体艺术活动类", scoreKey: "F3_B7_score", detailKey: "F3_B7_detail" },
  { section: "F3", subKey: "B8", title: "劳育类", scoreKey: "F3_B8_score", detailKey: "F3_B8_detail" },
];

const DEFAULT_SETTINGS = {
  gradeRules: [
    { grade: "优", min: 85 },
    { grade: "良", min: 75 },
    { grade: "合格", min: 60 },
    { grade: "不合格", min: 0 },
  ],
  submitDeadline: "",
  allowStudentEdit: true,
  allowReturnEdit: true,
  requireReviewerComment: false,
  allowStudentRegister: true,
  requireCounselorReview: true,
  requireStudentAffairsReview: true,
  lockSubmittedMaterial: false,
  objectionDays: 7,
  publishNotice: "请选择对应学年综测批次，确认智能填表结果后提交。",
};

function parseJson(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch (_) {
    return fallback;
  }
}

function normalizeIds(values) {
  return Array.isArray(values) ? [...new Set(values.map(Number).filter(Number.isInteger).filter(v => v > 0))] : [];
}

function attachmentPublicUrl(filePath) {
  const value = String(filePath || '').trim();
  if (!value) return '';
  if (/^(https?:)?\/\//i.test(value) || value.startsWith('/uploads/')) return value;
  return `/uploads/${value.replace(/^\/+/, '')}`;
}

function buildCourseDescription(courses) {
  if (!Array.isArray(courses)) return "";
  return courses
    .filter(course => course && (course.name || Number(course.score || 0) || Number(course.credit || 0)))
    .map(course => {
      const name = String(course.name || "未命名课程");
      const credit = Number(course.credit || 0);
      const score = Number(course.score || 0);
      return `${name}（${credit} 学分，${score} 分）`;
    })
    .join("；");
}

function buildSmartFillItems(fillData = {}) {
  return SMART_FILL_ITEM_DEFINITIONS.map((definition, index) => ({
    ...definition,
    score: Number(fillData[definition.scoreKey] || 0),
    reason: definition.section === "F2"
      ? buildCourseDescription(fillData[definition.detailKey])
      : String(fillData[definition.detailKey] || ""),
    sortOrder: index + 1,
  }));
}

function calculateSmartFillScores(items) {
  const f1 = items.filter(item => item.section === "F1").reduce((sum, item) => sum + Number(item.score || 0), 0);
  const f2 = items.filter(item => item.section === "F2").reduce((sum, item) => sum + Number(item.score || 0), 0);
  const f3 = items.filter(item => item.section === "F3").reduce((sum, item) => sum + Number(item.score || 0), 0);
  return {
    f1_basic_quality: Number(f1.toFixed(2)),
    f2_course_learning: Number(f2.toFixed(2)),
    f3_innovation_practice: Number(f3.toFixed(2)),
    total: Number((f1 * 0.1 + f2 * 0.65 + f3 * 0.25).toFixed(2)),
  };
}

async function getLatestSmartFillSource(studentId, db = pool) {
  const [results] = await db.execute(
    "SELECT id, user_id, result_path, original_name, created_at FROM fill_results WHERE user_id=? ORDER BY created_at DESC, id DESC LIMIT 1",
    [studentId]
  );
  if (!results.length) return null;
  const [ruleSets] = await db.execute(
    "SELECT id FROM rule_sets WHERE user_id=? AND status='published' ORDER BY published_at DESC, id DESC LIMIT 1",
    [studentId]
  );
  const fillData = await getFillDataPreview(studentId);
  const items = buildSmartFillItems(fillData);
  return {
    fillResult: results[0],
    ruleSetId: ruleSets[0]?.id || null,
    items,
    scores: calculateSmartFillScores(items),
  };
}

async function getWordDocumentMetadata(db, form) {
  const fillResultId = Number(form.fill_result_id || 0);
  if (!fillResultId) return null;
  const [rows] = await db.execute(
    "SELECT id, original_name, created_at FROM fill_results WHERE id=? AND user_id=? LIMIT 1",
    [fillResultId, form.student_id]
  );
  if (!rows.length) return null;
  return {
    id: rows[0].id,
    name: rows[0].original_name || "综测表_智能填表结果.docx",
    generated_at: rows[0].created_at,
  };
}

async function deleteFormCascade(db, formId) {
  await db.execute("DELETE FROM assessment_item_reviews WHERE form_id=?", [formId]);
  await db.execute("DELETE FROM assessment_objections WHERE form_id=?", [formId]);
  await db.execute("DELETE FROM assessment_review_records WHERE form_id=?", [formId]);
  await db.execute("DELETE FROM assessment_review_tasks WHERE form_id=?", [formId]);
  await db.execute("DELETE FROM assessment_form_items WHERE form_id=?", [formId]);
  await db.execute("DELETE FROM assessment_forms WHERE id=?", [formId]);
}

async function validateStudentEvidenceIds(db, studentId, items) {
  const evidenceIds = [...new Set((items || []).flatMap(item => normalizeIds(item?.evidence_ids)))];
  for (const item of items || []) {
    if (normalizeIds(item?.evidence_ids).length > 10) throw new Error('每个综测项目最多添加 10 个支撑材料');
  }
  if (!evidenceIds.length) return;
  const placeholders = evidenceIds.map(() => '?').join(',');
  const [rows] = await db.execute(
    `SELECT a.id
     FROM attachments a
     JOIN materials m ON m.id=a.material_id
     WHERE m.user_id=? AND a.id IN (${placeholders})`,
    [studentId, ...evidenceIds]
  );
  const ownedIds = new Set(rows.map(row => Number(row.id)));
  const invalid = evidenceIds.filter(id => !ownedIds.has(id));
  if (invalid.length) throw new Error('存在无权使用或已失效的支撑材料，请刷新页面后重试');
}

function normalizeDateTime(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return `${text} 00:00:00`;
  return text;
}

function currentAcademicYearStart() {
  const today = new Date();
  const year = today.getFullYear();
  return today.getMonth() + 1 >= 9 ? year : year - 1;
}

function parseSchoolYearStart(schoolYear) {
  const match = String(schoolYear || "").match(/^(\d{4})-(\d{4})$/);
  if (!match) throw new Error("学年格式必须为 YYYY-YYYY");
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (end !== start + 1) throw new Error("学年结束年份必须比开始年份大 1");
  return start;
}

function validateNewSchoolYear(schoolYear) {
  const start = parseSchoolYearStart(schoolYear);
  const current = currentAcademicYearStart();
  if (start < current) throw new Error("不能创建或改为早于当前学年的批次");
  if (start > current + 100) throw new Error("学年最多只能选择至当前学年后 100 年");
}

function getSchoolYear(data) {
  return data.school_year || String(data.title || "").match(/\d{4}-\d{4}/)?.[0] || "";
}

function calculateLevel(score, rules = DEFAULT_SETTINGS.gradeRules) {
  const sorted = [...rules].sort((a, b) => Number(b.min) - Number(a.min));
  return sorted.find(rule => Number(score || 0) >= Number(rule.min))?.grade || "不合格";
}

async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function getSettings(db = pool) {
  const [rows] = await db.execute("SELECT setting_key, setting_value FROM assessment_settings");
  const map = Object.fromEntries(rows.map(row => [row.setting_key, parseJson(row.setting_value, {})]));
  const general = { ...DEFAULT_SETTINGS, ...(map.general || {}) };
  return {
    ...general,
    gradeRules: Array.isArray(map.grade_rules) ? map.grade_rules : DEFAULT_SETTINGS.gradeRules,
    formStructure: FORM_STRUCTURE,
  };
}

async function updateSettings(data, operator) {
  if (operator.role !== "admin") throw new Error("仅管理员可修改系统设置");
  const settings = await getSettings();
  const gradeRules = Array.isArray(data.gradeRules)
    ? data.gradeRules
        .filter(rule => rule.grade !== undefined && rule.min !== undefined)
        .map(rule => ({ grade: String(rule.grade), min: Number(rule.min) }))
    : settings.gradeRules;
  const general = {
    submitDeadline: data.submitDeadline ?? settings.submitDeadline,
    allowStudentEdit: data.allowStudentEdit ?? settings.allowStudentEdit,
    allowReturnEdit: data.allowReturnEdit ?? settings.allowReturnEdit,
    requireReviewerComment: data.requireReviewerComment ?? settings.requireReviewerComment,
    allowStudentRegister: data.allowStudentRegister ?? settings.allowStudentRegister,
    requireCounselorReview: data.requireCounselorReview ?? settings.requireCounselorReview,
    requireStudentAffairsReview: data.requireStudentAffairsReview ?? settings.requireStudentAffairsReview,
    lockSubmittedMaterial: data.lockSubmittedMaterial ?? settings.lockSubmittedMaterial,
    objectionDays: Number(data.objectionDays ?? settings.objectionDays ?? 7),
    publishNotice: data.publishNotice ?? settings.publishNotice,
  };

  await withTransaction(async conn => {
    await conn.execute(
      "INSERT INTO assessment_settings (setting_key, setting_value) VALUES ('grade_rules', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(gradeRules)]
    );
    await conn.execute(
      "INSERT INTO assessment_settings (setting_key, setting_value) VALUES ('general', ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
      [JSON.stringify(general)]
    );
    await addLog(conn, operator, "更新系统设置", "综测规则", "管理员更新截止时间、注册开关、等级规则或流程选项");
  });
  return getSettings();
}

async function ensureClass({ name = "", college = "", major = "", grade = "" }, db = pool) {
  const className = String(name || "").trim();
  const collegeName = String(college || "").trim();
  const majorName = String(major || "").trim();
  const gradeName = String(grade || "").trim();
  if (!className) return null;
  await db.execute(
    `INSERT INTO assessment_classes (name, college, major, grade, status)
     VALUES (?, ?, ?, ?, 'active')
     ON DUPLICATE KEY UPDATE id = LAST_INSERT_ID(id), status='active', updated_at = CURRENT_TIMESTAMP`,
    [className, collegeName, majorName, gradeName]
  );
  const [rows] = await db.execute(
    "SELECT id FROM assessment_classes WHERE name=? AND college=? AND major=? AND grade=? LIMIT 1",
    [className, collegeName, majorName, gradeName]
  );
  return rows[0]?.id || null;
}

async function getUser(id, db = pool) {
  await cleanupExpiredBatchMemberships(db);
  const [rows] = await db.execute(
    `SELECT u.id, u.username, u.role, u.real_name, u.student_no, u.class_id, u.class_name,
            u.college, u.major, u.grade, u.phone, u.avatar, u.is_assessment_member,
            (SELECT COUNT(*) FROM assessment_batch_members bm WHERE bm.student_id=u.id AND bm.status='active') AS active_member_count,
            s.college AS scope_college, s.grade AS scope_grade, s.class_ids AS scope_class_ids
     FROM users u
     LEFT JOIN counselor_scopes s ON s.counselor_id = u.id
     WHERE u.id = ? LIMIT 1`,
    [id]
  );
  if (!rows.length) throw new Error("用户不存在");
  return formatUser(rows[0]);
}

function formatUser(row) {
  const user = {
    id: row.id,
    username: row.username,
    role: row.role,
    real_name: row.real_name || "",
    student_no: row.student_no || "",
    class_id: row.class_id,
    class_name: row.class_name || "",
    college: row.college || "",
    major: row.major || "",
    grade: row.grade || "",
    enrollment_grade: row.grade || "",
    phone: row.phone || "",
    avatar: row.avatar || "",
    is_assessment_member: !!row.is_assessment_member || Number(row.active_member_count || 0) > 0,
    active_member_count: Number(row.active_member_count || 0),
    role_name: ROLE_LABEL[row.role] || row.role,
    member_label: row.role === "student" && (!!row.is_assessment_member || Number(row.active_member_count || 0) > 0) ? "评价小组成员" : "",
  };
  if (row.role === "counselor") {
    user.scope = {
      college: row.scope_college || row.college || "",
      grade: row.scope_grade || row.grade || "",
      class_ids: normalizeIds(parseJson(row.scope_class_ids, [])),
    };
  }
  user.profile_missing_fields = missingProfileFields(user);
  user.profile_complete = user.profile_missing_fields.length === 0;
  return user;
}

function isInScope(user, target) {
  if (!user || !target) return false;
  if (["admin", "student_affairs"].includes(user.role)) return true;
  if (user.role !== "counselor") return Number(user.id) === Number(target.student_id || target.id);
  const scope = user.scope || {};
  if (!scope.college || !scope.grade) return false;
  if (scope.college !== (target.college || "")) return false;
  if (scope.grade !== (target.grade || target.enrollment_grade || "")) return false;
  const classIds = normalizeIds(scope.class_ids);
  return !classIds.length || classIds.includes(Number(target.class_id));
}

function isBatchInScope(user, batch) {
  if (!user || !batch) return false;
  if (["admin", "student_affairs"].includes(user.role)) return true;
  if (user.role !== "counselor") return false;
  const scope = user.scope || {};
  return !!scope.college
    && !!scope.grade
    && scope.college === String(batch.college || "")
    && scope.grade === String(batch.grade || "");
}

async function addLog(db, operator, action, target, detail) {
  await db.execute(
    `INSERT INTO assessment_operation_logs
      (operator_id, operator_name, operator_role, action, target, detail)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      operator?.id || null,
      operator?.real_name || operator?.username || ROLE_LABEL[operator?.role] || "系统",
      operator?.role || "system",
      action || "",
      target || "",
      detail || "",
    ]
  );
}

async function getReviewAssignments(batchId, db = pool) {
  const [rows] = await db.execute(
    `SELECT a.id, a.target_class_id, a.target_class_name, a.reviewer_class_id, a.reviewer_class_name
     FROM assessment_review_assignments a
     WHERE a.batch_id = ?
     ORDER BY a.id`,
    [batchId]
  );
  return rows.map(row => ({
    id: row.id,
    target_class_id: row.target_class_id,
    target_class_name: row.target_class_name,
    reviewer_class_id: row.reviewer_class_id,
    reviewer_class_name: row.reviewer_class_name,
  }));
}

async function enrichBatch(row, db = pool) {
  const options = parseJson(row.options, {});
  const [counts] = await db.execute(
    `SELECT
       (SELECT COUNT(*) FROM users u WHERE u.role='student' AND u.college=? AND u.grade=?) AS target_student_count,
       SUM(CASE WHEN f.status <> 'smart_ready' THEN 1 ELSE 0 END) AS submitted_count,
       SUM(CASE WHEN f.status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
       SUM(CASE WHEN f.status IN ('pending_class_committee','pending_counselor','pending_student_affairs','pending_objection_review') THEN 1 ELSE 0 END) AS pending_count
     FROM assessment_forms f WHERE f.batch_id = ?`,
    [row.college || "", row.grade || "", row.id]
  );
  const count = counts[0] || {};
  return {
    ...row,
    options,
    allowStudentEdit: options.allowStudentEdit,
    allowReturnEdit: options.allowReturnEdit,
    requireReviewerComment: options.requireReviewerComment,
    requireCounselorReview: options.requireCounselorReview,
    requireStudentAffairsReview: options.requireStudentAffairsReview,
    lockSubmittedMaterial: options.lockSubmittedMaterial,
    objectionDays: options.objectionDays,
    review_assignments: await getReviewAssignments(row.id, db),
    target_student_count: Number(count.target_student_count || 0),
    submitted_count: Number(count.submitted_count || 0),
    approved_count: Number(count.approved_count || 0),
    pending_count: Number(count.pending_count || 0),
  };
}

async function listBatches(user) {
  let sql = "SELECT * FROM assessment_batches WHERE status <> 'deleted'";
  const params = [];
  if (user.role === "student") {
    sql += " AND college = ? AND grade = ?";
    params.push(user.college || "", user.grade || "");
  } else if (user.role === "counselor") {
    if (!user.scope?.college || !user.scope?.grade) return [];
    sql += " AND college = ? AND grade = ?";
    params.push(user.scope.college, user.scope.grade);
  }
  sql += " ORDER BY COALESCE(start_time, created_at) DESC, id DESC";
  const [rows] = await pool.execute(sql, params);
  return Promise.all(rows.map(row => enrichBatch(row)));
}

async function listStudentBatches(user) {
  if (user.role !== "student") return [];
  assertProfileComplete(user, "查看综测批次");
  return listBatches(user);
}

async function getBatchForUpdate(conn, id) {
  const [rows] = await conn.execute("SELECT * FROM assessment_batches WHERE id = ? AND status <> 'deleted' FOR UPDATE", [id]);
  if (!rows.length) throw new Error("批次不存在");
  return rows[0];
}

async function validateBatchDuplicate(db, { id = 0, schoolYear, college, grade }) {
  const [rows] = await db.execute(
    `SELECT id FROM assessment_batches
     WHERE status <> 'deleted' AND school_year = ? AND college = ? AND grade = ? AND id <> ? LIMIT 1`,
    [schoolYear, college, grade, id]
  );
  if (rows.length) throw new Error("该学院、该年级在该学年已经存在批次，每年只能填写一次");
}

async function normalizeAssignments(db, batch, assignments) {
  const normalized = [];
  for (const input of assignments || []) {
    const targetId = Number(input.target_class_id);
    const reviewerId = Number(input.reviewer_class_id);
    if (!targetId || !reviewerId) throw new Error("请完整选择被评班级和评测班级");
    if (targetId === reviewerId) throw new Error("跨班互评不支持本班评本班");
    const [classes] = await db.execute(
      "SELECT id, name, college, major, grade FROM assessment_classes WHERE id IN (?, ?)",
      [targetId, reviewerId]
    );
    const targetClass = classes.find(item => Number(item.id) === targetId);
    const reviewerClass = classes.find(item => Number(item.id) === reviewerId);
    if (!targetClass || !reviewerClass) throw new Error("互评配置中的班级不存在");
    for (const cls of [targetClass, reviewerClass]) {
      if (cls.college !== batch.college || cls.grade !== batch.grade) {
        throw new Error("互评班级必须属于当前批次的学院和年级");
      }
    }
    normalized.push({
      target_class_id: targetClass.id,
      target_class_name: targetClass.name,
      reviewer_class_id: reviewerClass.id,
      reviewer_class_name: reviewerClass.name,
    });
  }
  if (new Set(normalized.map(item => item.target_class_id)).size !== normalized.length) {
    throw new Error("同一个被评班级只能配置一条互评关系");
  }
  return normalized;
}

async function replaceAssignments(conn, batch, assignments, operator) {
  const normalized = await normalizeAssignments(conn, batch, assignments);
  const [oldRows] = await conn.execute("SELECT id FROM assessment_review_assignments WHERE batch_id = ?", [batch.id]);
  if (oldRows.length) {
    const ids = oldRows.map(row => row.id);
    await conn.query("DELETE FROM assessment_review_assignment_members WHERE assignment_id IN (?)", [ids]);
  }
  await conn.execute("DELETE FROM assessment_review_assignments WHERE batch_id = ?", [batch.id]);
  for (const item of normalized) {
    await conn.execute(
      `INSERT INTO assessment_review_assignments
        (batch_id, target_class_id, target_class_name, reviewer_class_id, reviewer_class_name, created_by)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [batch.id, item.target_class_id, item.target_class_name, item.reviewer_class_id, item.reviewer_class_name, operator.id]
    );
  }
}

async function createBatch(data, operator) {
  if (operator.role !== "admin") throw new Error("仅管理员可创建批次");
  if (!data.college) throw new Error("创建批次必须指定学院");
  if (!data.grade) throw new Error("创建批次必须指定年级");
  const schoolYear = getSchoolYear(data);
  if (!schoolYear) throw new Error("创建批次必须指定学年，例如 2025-2026");
  validateNewSchoolYear(schoolYear);

  const id = await withTransaction(async conn => {
    await validateBatchDuplicate(conn, { schoolYear, college: data.college, grade: data.grade });
    const settings = await getSettings(conn);
    const options = {
      allowStudentEdit: data.allowStudentEdit ?? settings.allowStudentEdit,
      allowReturnEdit: data.allowReturnEdit ?? settings.allowReturnEdit,
      requireReviewerComment: data.requireReviewerComment ?? settings.requireReviewerComment,
      requireCounselorReview: data.requireCounselorReview ?? settings.requireCounselorReview,
      requireStudentAffairsReview: data.requireStudentAffairsReview ?? settings.requireStudentAffairsReview,
      lockSubmittedMaterial: data.lockSubmittedMaterial ?? settings.lockSubmittedMaterial,
      objectionDays: Number(data.objectionDays ?? settings.objectionDays ?? 7),
    };
    const [result] = await conn.execute(
      `INSERT INTO assessment_batches
        (school_year, title, college, grade, description, start_time, end_time, requirements, status, created_by, creator_name, options)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        schoolYear,
        data.title || `${schoolYear}学年综测`,
        data.college,
        data.grade,
        data.description || "",
        normalizeDateTime(data.start_time),
        normalizeDateTime(data.end_time),
        data.requirements || "",
        data.status || "published",
        operator.id,
        operator.real_name || operator.username || "管理员",
        JSON.stringify(options),
      ]
    );
    const batch = { id: result.insertId, school_year: schoolYear, college: data.college, grade: data.grade };
    if (Array.isArray(data.review_assignments)) await replaceAssignments(conn, batch, data.review_assignments, operator);
    await addLog(conn, operator, "发布批次", data.title || `${schoolYear}学年综测`, `目标：${data.college}${data.grade}`);
    return result.insertId;
  });
  const [rows] = await pool.execute("SELECT * FROM assessment_batches WHERE id = ?", [id]);
  return enrichBatch(rows[0]);
}

async function updateBatch(id, data, operator) {
  const batchId = Number(id);
  await withTransaction(async conn => {
    const current = await getBatchForUpdate(conn, batchId);
    if (operator.role === "counselor") {
      if (!isBatchInScope(operator, current)) throw new Error("只能配置管辖学院和年级范围内的批次");
      if (!Array.isArray(data.review_assignments)) throw new Error("请提交跨班互评配置");
      await replaceAssignments(conn, current, data.review_assignments, operator);
      await addLog(conn, operator, "修改互评配置", current.title, "辅导员更新跨班互评关系");
      return;
    }
    if (operator.role !== "admin") throw new Error("无权修改批次");

    const isHistorical = parseSchoolYearStart(current.school_year) < currentAcademicYearStart();
    const next = isHistorical
      ? {
          school_year: current.school_year,
          title: current.title,
          college: current.college,
          grade: current.grade,
          description: data.description ?? current.description,
          start_time: current.start_time,
          end_time: current.end_time,
          requirements: current.requirements,
          status: data.status ?? current.status,
        }
      : {
          school_year: data.school_year ?? current.school_year,
          title: data.title ?? current.title,
          college: data.college ?? current.college,
          grade: data.grade ?? current.grade,
          description: data.description ?? current.description,
          start_time: data.start_time !== undefined ? normalizeDateTime(data.start_time) : current.start_time,
          end_time: data.end_time !== undefined ? normalizeDateTime(data.end_time) : current.end_time,
          requirements: data.requirements ?? current.requirements,
          status: data.status ?? current.status,
        };
    if (!next.school_year || !next.college || !next.grade) throw new Error("批次的学年、学院和年级不能为空");
    if (!isHistorical) {
      if (next.school_year !== current.school_year) validateNewSchoolYear(next.school_year);
      else parseSchoolYearStart(next.school_year);
      await validateBatchDuplicate(conn, {
        id: batchId,
        schoolYear: next.school_year,
        college: next.college,
        grade: next.grade,
      });
    }

    const currentOptions = parseJson(current.options, {});
    const options = isHistorical
      ? currentOptions
      : {
          ...currentOptions,
          ...(data.allowStudentEdit !== undefined ? { allowStudentEdit: !!data.allowStudentEdit } : {}),
          ...(data.allowReturnEdit !== undefined ? { allowReturnEdit: !!data.allowReturnEdit } : {}),
          ...(data.requireReviewerComment !== undefined ? { requireReviewerComment: !!data.requireReviewerComment } : {}),
          ...(data.requireCounselorReview !== undefined ? { requireCounselorReview: !!data.requireCounselorReview } : {}),
          ...(data.requireStudentAffairsReview !== undefined ? { requireStudentAffairsReview: !!data.requireStudentAffairsReview } : {}),
          ...(data.lockSubmittedMaterial !== undefined ? { lockSubmittedMaterial: !!data.lockSubmittedMaterial } : {}),
          ...(data.objectionDays !== undefined ? { objectionDays: Number(data.objectionDays || 0) } : {}),
        };
    await conn.execute(
      `UPDATE assessment_batches
       SET school_year=?, title=?, college=?, grade=?, description=?, start_time=?, end_time=?, requirements=?, status=?, options=?
       WHERE id=?`,
      [next.school_year, next.title, next.college, next.grade, next.description, next.start_time, next.end_time, next.requirements, next.status, JSON.stringify(options), batchId]
    );
    if (Array.isArray(data.review_assignments)) {
      await replaceAssignments(conn, { id: batchId, college: next.college, grade: next.grade }, data.review_assignments, operator);
    }
    await addLog(conn, operator, "修改批次", next.title, "更新批次信息或跨班互评配置");
  });
  const [rows] = await pool.execute("SELECT * FROM assessment_batches WHERE id = ?", [batchId]);
  return enrichBatch(rows[0]);
}

async function updateBatchStatus(id, status, operator) {
  if (operator.role !== "admin") throw new Error("仅管理员可修改批次状态");
  const result = await updateBatch(id, { status }, operator);
  if (["closed", "archived"].includes(String(status))) {
    await withTransaction(async conn => expireBatchMembershipsIfComplete(conn, Number(id)));
  }
  return result;
}

async function deleteBatch(id, operator) {
  if (operator.role !== "admin") throw new Error("仅管理员可删除批次");
  return withTransaction(async conn => {
    const batch = await getBatchForUpdate(conn, Number(id));
    await conn.execute("UPDATE assessment_batches SET status='deleted' WHERE id=?", [batch.id]);
    await conn.execute("UPDATE assessment_batch_members SET status='inactive', removed_at=NOW() WHERE batch_id=? AND status='active'", [batch.id]);
    const [members] = await conn.execute("SELECT student_id FROM assessment_batch_members WHERE batch_id=?", [batch.id]);
    for (const member of members) await syncLegacyMemberFlag(conn, member.student_id);
    await addLog(conn, operator, "删除批次", batch.title, "批次已从管理列表删除，批次评价小组权限已收回");
    return { ...batch, status: "deleted" };
  });
}

async function getScopeOptions() {
  const [classes] = await pool.execute("SELECT id, name, college, major, grade, status FROM assessment_classes WHERE COALESCE(status,'active') <> 'inactive' ORDER BY college, major, grade DESC, name");
  const [students] = await pool.execute(
    `SELECT u.id, u.username, u.role, u.real_name, u.student_no, u.class_id, u.class_name, u.college, u.major, u.grade,
            u.is_assessment_member,
            (SELECT COUNT(*) FROM assessment_batch_members bm WHERE bm.student_id=u.id AND bm.status='active') AS active_member_count
     FROM users u WHERE u.role='student' ORDER BY u.college, u.grade DESC, u.class_name, u.student_no`
  );
  const [batchMembers] = await pool.execute(
    `SELECT bm.id, bm.batch_id, bm.student_id, bm.status, bm.assigned_at, bm.removed_at,
            u.real_name, u.student_no, u.class_id, u.class_name, u.college, u.major, u.grade
     FROM assessment_batch_members bm
     JOIN users u ON u.id=bm.student_id
     WHERE bm.status='active'
     ORDER BY bm.batch_id, u.class_name, u.student_no`
  );
  const formatted = students.map(formatUser);
  return {
    colleges: [...new Set([...classes.map(item => item.college), ...formatted.map(item => item.college)].filter(Boolean))].sort(),
    majors: [...new Set([...classes.map(item => item.major), ...formatted.map(item => item.major)].filter(Boolean))].sort(),
    grades: [...new Set([...classes.map(item => item.grade), ...formatted.map(item => item.grade)].filter(Boolean))].sort().reverse(),
    classes,
    members: formatted.filter(item => item.is_assessment_member),
    batch_memberships: batchMembers,
    students: formatted,
  };
}

function missingProfileFields(user) {
  if (!user) return ["用户信息"];
  if (user.role === "student") {
    const required = [
      ["real_name", "姓名"],
      ["student_no", "学号"],
      ["college", "学院"],
      ["grade", "年级"],
      ["major", "专业"],
      ["class_name", "班级"],
    ];
    return required.filter(([key]) => !String(user[key] || "").trim()).map(([, label]) => label);
  }
  if (user.role === "counselor") {
    const college = user.scope?.college || user.college;
    const grade = user.scope?.grade || user.grade;
    const missing = [];
    if (!String(college || "").trim()) missing.push("学院");
    if (!String(grade || "").trim()) missing.push("年级");
    return missing;
  }
  return [];
}

function assertProfileComplete(user, action = "使用该功能") {
  const missing = missingProfileFields(user);
  if (missing.length) throw new Error(`请先在个人中心完善${missing.join("、")}后再${action}`);
}

async function updateUserProfile(userId, data = {}) {
  const user = await getUser(userId);
  const next = {
    real_name: String(data.real_name ?? user.real_name ?? "").trim(),
    phone: String(data.phone ?? user.phone ?? "").trim(),
    avatar: String(data.avatar ?? user.avatar ?? "").trim(),
    college: String(data.college ?? user.college ?? "").trim(),
    major: String(data.major ?? user.major ?? "").trim(),
    grade: String(data.grade ?? user.grade ?? "").trim(),
    class_name: String(data.class_name ?? user.class_name ?? "").trim(),
  };
  const preview = { ...user, ...next, scope: user.role === "counselor" ? { ...(user.scope || {}), college: next.college, grade: next.grade } : user.scope };
  const missing = missingProfileFields(preview);
  if (missing.length) throw new Error(`请完善必填信息：${missing.join("、")}`);
  const classId = user.role === "student"
    ? await ensureClass({ name: next.class_name, college: next.college, major: next.major, grade: next.grade })
    : user.class_id || null;
  await withTransaction(async conn => {
    await conn.execute(
      `UPDATE users
       SET real_name=?, phone=?, avatar=?, college=?, major=?, grade=?, class_name=?, class_id=?
       WHERE id=?`,
      [next.real_name, next.phone, next.avatar, next.college, next.major, next.grade, next.class_name, classId, userId]
    );
    if (user.role === "counselor") {
      await conn.execute(
        `INSERT INTO counselor_scopes (counselor_id, college, grade, class_ids)
         VALUES (?, ?, ?, COALESCE((SELECT class_ids FROM (SELECT class_ids FROM counselor_scopes WHERE counselor_id=?) x), JSON_ARRAY()))
         ON DUPLICATE KEY UPDATE college=VALUES(college), grade=VALUES(grade)`,
        [userId, next.college, next.grade, userId]
      );
    }
    await addLog(conn, { ...user, ...next }, "更新个人中心", user.username, "用户完善 module3 个人信息");
  });
  return getUser(userId);
}

async function updateCounselorScope(userId, scope) {
  const counselor = await getUser(userId);
  if (counselor.role !== "counselor") throw new Error("仅辅导员可设置管辖范围");
  if (!scope.college) throw new Error("学院为必选项");
  if (!scope.grade) throw new Error("年级为必选项");
  const classIds = normalizeIds(scope.class_ids);
  if (classIds.length) {
    const placeholders = classIds.map(() => "?").join(",");
    const [classes] = await pool.execute(
      `SELECT id FROM assessment_classes WHERE id IN (${placeholders}) AND college=? AND grade=?`,
      [...classIds, scope.college, scope.grade]
    );
    if (classes.length !== classIds.length) throw new Error("所选班级必须属于当前学院和年级");
  }
  await withTransaction(async conn => {
    await conn.execute(
      `INSERT INTO counselor_scopes (counselor_id, college, grade, class_ids)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE college=VALUES(college), grade=VALUES(grade), class_ids=VALUES(class_ids)`,
      [userId, scope.college, scope.grade, JSON.stringify(classIds)]
    );
    await addLog(conn, counselor, "设置管辖范围", counselor.real_name || counselor.username, `${scope.college}${scope.grade}`);
  });
  return getUser(userId);
}

async function listStudents(user) {
  const [rows] = await pool.execute(
    `SELECT u.id, u.username, u.role, u.real_name, u.student_no, u.class_id, u.class_name,
            u.college, u.major, u.grade, u.phone, u.avatar, u.is_assessment_member,
            f.status AS latest_status, f.scores AS latest_scores
     FROM users u
     LEFT JOIN assessment_forms f ON f.id = (
       SELECT f2.id FROM assessment_forms f2 WHERE f2.student_id=u.id ORDER BY f2.updated_at DESC, f2.id DESC LIMIT 1
     )
     WHERE u.role='student'
     ORDER BY u.college, u.grade DESC, u.class_name, u.student_no`
  );
  return rows
    .filter(row => isInScope(user, row))
    .map(row => {
      const scores = parseJson(row.latest_scores, {});
      return {
        ...formatUser(row),
        forms: [],
        latest_status_label: row.latest_status ? STATUS_LABEL[row.latest_status] || row.latest_status : "暂无综测表",
        latest_total_score: row.latest_status ? scores.total ?? "-" : "-",
      };
    });
}

async function getAvailableMemberBatches(operator, db = pool) {
  let sql = "SELECT * FROM assessment_batches WHERE status='published'";
  const params = [];
  if (operator.role === "counselor") {
    if (!operator.scope?.college || !operator.scope?.grade) return [];
    sql += " AND college=? AND grade=?";
    params.push(operator.scope.college, operator.scope.grade);
  }
  sql += " ORDER BY COALESCE(start_time, created_at) DESC, id DESC";
  const [rows] = await db.execute(sql, params);
  return rows;
}

async function getActiveBatchMembers(db, batchId, classId = null, excludeStudentId = null) {
  const params = [Number(batchId)];
  let sql = `SELECT bm.id AS membership_id, u.id, u.real_name, u.username, u.student_no, u.class_id, u.class_name
             FROM assessment_batch_members bm
             JOIN users u ON u.id=bm.student_id
             WHERE bm.batch_id=? AND bm.status='active' AND u.role='student'`;
  if (classId) {
    sql += " AND u.class_id=?";
    params.push(Number(classId));
  }
  if (excludeStudentId) {
    sql += " AND u.id<>?";
    params.push(Number(excludeStudentId));
  }
  sql += " ORDER BY u.class_name, u.student_no";
  const [rows] = await db.execute(sql, params);
  return rows;
}

async function transferPendingTasks(conn, batchId, fromStudentId, mode = "", targetReviewerId = 0) {
  const [tasks] = await conn.execute(
    "SELECT * FROM assessment_review_tasks WHERE batch_id=? AND reviewer_id=? AND status='pending' FOR UPDATE",
    [Number(batchId), Number(fromStudentId)]
  );
  if (!tasks.length) return { transferred: 0 };

  if (mode === "specific") {
    if (!targetReviewerId || Number(targetReviewerId) === Number(fromStudentId)) throw new Error("请选择一个其他评价小组成员接收待评任务");
    const candidates = await getActiveBatchMembers(conn, batchId, null, fromStudentId);
    const target = candidates.find(item => Number(item.id) === Number(targetReviewerId));
    if (!target) throw new Error("指定接收人不是当前批次有效评价小组成员");
    for (const task of tasks) {
      await conn.execute(
        `UPDATE assessment_review_tasks
         SET reviewer_id=?, reviewer_name=?, reviewer_no=?, reviewer_class_id=?, reviewer_class_name=?, assigned_at=CURRENT_TIMESTAMP
         WHERE id=?`,
        [target.id, target.real_name || target.username || "", target.student_no || "", target.class_id || null, target.class_name || "", task.id]
      );
    }
    return { transferred: tasks.length, mode, target: target.real_name || target.student_no || String(target.id) };
  }

  if (mode !== "average") throw new Error("该成员仍有待评任务，请选择平均分配或指定分配后再移除");
  const grouped = new Map();
  for (const task of tasks) {
    const key = Number(task.reviewer_class_id || 0);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(task);
  }
  let transferred = 0;
  for (const [classId, groupTasks] of grouped.entries()) {
    let candidates = await getActiveBatchMembers(conn, batchId, classId || null, fromStudentId);
    if (!candidates.length) candidates = await getActiveBatchMembers(conn, batchId, null, fromStudentId);
    if (!candidates.length) throw new Error("当前批次没有剩余评价小组成员可接收待评任务");
    const loadMap = new Map();
    for (const candidate of candidates) {
      const [[load]] = await conn.execute(
        "SELECT COUNT(*) AS count FROM assessment_review_tasks WHERE batch_id=? AND reviewer_id=? AND status='pending'",
        [Number(batchId), candidate.id]
      );
      loadMap.set(candidate.id, Number(load.count || 0));
    }
    for (const task of groupTasks) {
      const sorted = [...candidates].sort((a, b) => (loadMap.get(a.id) - loadMap.get(b.id)) || (Math.random() - 0.5));
      const target = sorted[0];
      await conn.execute(
        `UPDATE assessment_review_tasks
         SET reviewer_id=?, reviewer_name=?, reviewer_no=?, reviewer_class_id=?, reviewer_class_name=?, assigned_at=CURRENT_TIMESTAMP
         WHERE id=?`,
        [target.id, target.real_name || target.username || "", target.student_no || "", target.class_id || null, target.class_name || "", task.id]
      );
      loadMap.set(target.id, (loadMap.get(target.id) || 0) + 1);
      transferred += 1;
    }
  }
  return { transferred, mode };
}

async function setAssessmentMember(operator, studentId, payload = {}) {
  if (!["admin", "counselor"].includes(operator.role)) throw new Error("无权管理评价小组身份");
  const enabled = typeof payload === "object" ? !!payload.enabled : !!payload;
  const batchId = Number(typeof payload === "object" ? payload.batch_id : 0);
  const student = await getUser(studentId);
  if (student.role !== "student") throw new Error("学生不存在");
  if (operator.role === "counselor" && !isInScope(operator, student)) throw new Error("只能管理管辖范围内的学生");
  const availableBatches = await getAvailableMemberBatches(operator);
  if (!availableBatches.length) throw new Error("当前还没有可以评价的批次");
  if (!batchId) throw new Error(availableBatches.length > 1 ? "存在多个进行中的批次，请先选择具体批次" : "请先选择需要授权的批次");
  const batch = availableBatches.find(item => Number(item.id) === batchId);
  if (!batch) throw new Error("所选批次不存在、未发布或不在你的管辖范围内");

  return withTransaction(async conn => {
    if (enabled) {
      await conn.execute(
        `INSERT INTO assessment_batch_members (batch_id, student_id, assigned_by, status, assigned_at, removed_at)
         VALUES (?, ?, ?, 'active', CURRENT_TIMESTAMP, NULL)
         ON DUPLICATE KEY UPDATE status='active', assigned_by=VALUES(assigned_by), assigned_at=CURRENT_TIMESTAMP, removed_at=NULL`,
        [batchId, student.id, operator.id]
      );
      await syncLegacyMemberFlag(conn, student.id);
      await addLog(conn, operator, "赋予评价小组身份", student.real_name || student.student_no, `${batch.title} 批次授权生效`);
      return { student: await getUser(student.id, conn), batch_id: batchId, enabled: true };
    }

    const transfer = await transferPendingTasks(
      conn,
      batchId,
      student.id,
      String(payload.transfer_mode || ""),
      Number(payload.target_reviewer_id || 0)
    );
    await conn.execute("UPDATE assessment_batch_members SET status='inactive', removed_at=CURRENT_TIMESTAMP WHERE batch_id=? AND student_id=?", [batchId, student.id]);
    await syncLegacyMemberFlag(conn, student.id);
    await addLog(conn, operator, "移除评价小组身份", student.real_name || student.student_no, `${batch.title} 批次授权已移除；转移待评任务 ${transfer.transferred || 0} 个`);
    return { student: await getUser(student.id, conn), batch_id: batchId, enabled: false, transfer };
  });
}

async function getBatchById(id, db = pool) {
  const [rows] = await db.execute("SELECT * FROM assessment_batches WHERE id=? AND status <> 'deleted' LIMIT 1", [id]);
  return rows[0] || null;
}

function batchOptions(batch, settings) {
  return { ...settings, ...parseJson(batch?.options, {}) };
}

function nextStatusAfter(stage, action, options = {}) {
  if (action === "return") {
    if (stage === "assessment_member") return "returned_by_class_committee";
    if (stage === "counselor") return "returned_by_counselor";
    if (stage === "student_affairs") return "returned_by_student_affairs";
  }
  if (action === "reject") return "rejected";
  if (stage === "assessment_member") {
    if (options.requireCounselorReview) return "pending_counselor";
    if (options.requireStudentAffairsReview) return "pending_student_affairs";
    return "approved";
  }
  if (stage === "counselor") {
    return options.requireStudentAffairsReview ? "pending_student_affairs" : "approved";
  }
  if (stage === "student_affairs") return "approved";
  return "approved";
}

async function hasActiveBatchMember(db, batchId, studentId) {
  const [rows] = await db.execute(
    "SELECT id FROM assessment_batch_members WHERE batch_id=? AND student_id=? AND status='active' LIMIT 1",
    [Number(batchId), Number(studentId)]
  );
  return rows.length > 0;
}

async function syncLegacyMemberFlag(db, studentId) {
  const [[row]] = await db.execute(
    "SELECT COUNT(*) AS count FROM assessment_batch_members WHERE student_id=? AND status='active'",
    [Number(studentId)]
  );
  await db.execute("UPDATE users SET is_assessment_member=? WHERE id=? AND role='student'", [Number(row.count || 0) > 0 ? 1 : 0, Number(studentId)]);
}

function canStudentEdit(form, batch, settings) {
  if (!batch || batch.status !== "published") return false;
  const options = batchOptions(batch, settings);
  if (form.status === "smart_ready") return !!options.allowStudentEdit;
  if (String(form.status || "").startsWith("returned")) return !options.lockSubmittedMaterial && !!options.allowReturnEdit;
  return false;
}

function readonlyReason(form, batch, settings) {
  if (!batch) return "批次不存在";
  if (batch.status !== "published") return "该批次未发布或已关闭";
  if (canStudentEdit(form, batch, settings)) return "";
  const map = {
    pending_class_committee: "已提交，正在等待综测成员评价",
    pending_counselor: "综测成员已通过，正在等待辅导员评价",
    pending_student_affairs: "辅导员已通过，正在等待学生工作处评价",
    pending_objection_review: "已提交异议，正在等待原评价小组成员再次评测",
    approved: "已认定通过，当前不可修改",
    rejected: "当前结果已不予认定，当前不可修改",
  };
  return map[form.status] || "当前状态不可修改";
}


function isFinalStatus(status) {
  return ["approved", "rejected"].includes(String(status || ""));
}

function addDays(value, days) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setDate(date.getDate() + Math.max(0, Number(days || 0)));
  return date;
}

async function cleanupExpiredBatchMemberships(db = pool) {
  const [batches] = await db.execute("SELECT id FROM assessment_batches WHERE status IN ('closed','archived')");
  for (const batch of batches) await expireBatchMembershipsIfComplete(db, batch.id);
}

async function expireBatchMembershipsIfComplete(db, batchId) {
  const batch = await getBatchById(batchId, db);
  if (!batch || !["closed", "archived", "deleted"].includes(batch.status)) return { expired: 0, reason: "批次仍在进行" };
  const [[pendingTask]] = await db.execute(
    "SELECT COUNT(*) AS count FROM assessment_review_tasks WHERE batch_id=? AND status='pending'",
    [Number(batchId)]
  );
  const [[pendingForm]] = await db.execute(
    `SELECT COUNT(*) AS count FROM assessment_forms
     WHERE batch_id=? AND status IN ('pending_class_committee','pending_counselor','pending_student_affairs','pending_objection_review')`,
    [Number(batchId)]
  );
  const [[pendingObjection]] = await db.execute(
    "SELECT COUNT(*) AS count FROM assessment_objections WHERE batch_id=? AND status='pending'",
    [Number(batchId)]
  );
  if (Number(pendingTask.count || 0) || Number(pendingForm.count || 0) || Number(pendingObjection.count || 0)) {
    return { expired: 0, reason: "仍有待处理评价或异议" };
  }
  const options = batchOptions(batch, await getSettings(db));
  const [released] = await db.execute(
    "SELECT result_released_at FROM assessment_forms WHERE batch_id=? AND result_released_at IS NOT NULL",
    [Number(batchId)]
  );
  const now = Date.now();
  const deadlinePending = released.some(row => {
    const deadline = addDays(row.result_released_at, options.objectionDays);
    return deadline && deadline.getTime() > now;
  });
  if (deadlinePending) return { expired: 0, reason: "异议期限尚未结束" };
  const [active] = await db.execute(
    "SELECT student_id FROM assessment_batch_members WHERE batch_id=? AND status='active'",
    [Number(batchId)]
  );
  if (!active.length) return { expired: 0, reason: "无有效权限" };
  await db.execute(
    "UPDATE assessment_batch_members SET status='inactive', removed_at=NOW() WHERE batch_id=? AND status='active'",
    [Number(batchId)]
  );
  for (const member of active) await syncLegacyMemberFlag(db, member.student_id);
  return { expired: active.length, reason: "批次评价与异议流程已结束" };
}

async function getReviewableItemIds(db, form, reviewer, task = null) {
  if (task?.stage === "objection" || form.status === "pending_objection_review") {
    const [rows] = await db.execute(
      "SELECT item_id FROM assessment_objections WHERE form_id=? AND status='pending' ORDER BY id",
      [form.id]
    );
    return rows.map(row => Number(row.item_id));
  }
  const [rows] = await db.execute("SELECT id FROM assessment_form_items WHERE form_id=? ORDER BY sort_order, id", [form.id]);
  return rows.map(row => Number(row.id));
}

async function saveItemReviews(db, form, reviewer, reviewerRole, stage, itemReviews, reviewableIds, fallbackAction) {
  const reviewMap = new Map((Array.isArray(itemReviews) ? itemReviews : []).map(item => [Number(item.item_id), item]));
  const [items] = reviewableIds.length
    ? await db.query("SELECT id, score FROM assessment_form_items WHERE form_id=? AND id IN (?)", [form.id, reviewableIds])
    : [[]];
  for (const item of items) {
    const input = reviewMap.get(Number(item.id)) || {};
    const action = ["approve", "return", "reject"].includes(input.action) ? input.action : fallbackAction;
    const reason = String(input.reason || "").trim();
    const reviewedScore = Number.isFinite(Number(input.score)) ? Number(input.score) : Number(item.score || 0);
    await db.execute(
      `INSERT INTO assessment_item_reviews
        (form_id, item_id, reviewer_id, reviewer_role, stage, action, reason, reviewed_score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE action=VALUES(action), reason=VALUES(reason), reviewed_score=VALUES(reviewed_score), updated_at=CURRENT_TIMESTAMP`,
      [form.id, item.id, reviewer.id, reviewerRole, stage, action, reason, reviewedScore]
    );
  }
}

async function submitObjection(formId, student, data = {}) {
  const inputs = Array.isArray(data.items) ? data.items : [];
  const normalized = inputs.map(item => ({
    itemId: Number(item?.item_id || 0),
    reason: String(item?.reason || "").trim(),
  }));
  if (!normalized.length) throw new Error("请至少标记一个有异议的加分项");
  if (normalized.some(item => !item.itemId)) throw new Error("异议项目无效");
  if (normalized.some(item => !item.reason)) throw new Error("每个已标记项目都必须填写异议理由");
  if (new Set(normalized.map(item => item.itemId)).size !== normalized.length) throw new Error("异议项目不能重复");

  return withTransaction(async conn => {
    const [rows] = await conn.execute("SELECT * FROM assessment_forms WHERE id=? LIMIT 1 FOR UPDATE", [Number(formId)]);
    if (!rows.length) throw new Error("评价表不存在");
    const form = rows[0];
    if (student.role !== "student" || Number(form.student_id) !== Number(student.id)) throw new Error("只能对自己的综测结果发起异议");
    if (!form.result_released_at || !isFinalStatus(form.status)) throw new Error("当前结果尚未完成全部评价，暂不能发起异议");

    const batch = await getBatchById(form.batch_id, conn);
    const options = batchOptions(batch, await getSettings(conn));
    const deadline = addDays(form.result_released_at, options.objectionDays);
    if (!deadline || deadline.getTime() < Date.now()) throw new Error("该批次异议期限已结束");

    const [existing] = await conn.execute(
      "SELECT id, status FROM assessment_objections WHERE form_id=? AND student_id=? LIMIT 1 FOR UPDATE",
      [form.id, student.id]
    );
    if (existing.length) throw new Error("该综测表已经提交过异议申请，不能重复提交");

    const itemIds = normalized.map(item => item.itemId);
    const placeholders = itemIds.map(() => "?").join(",");
    const [items] = await conn.execute(
      `SELECT id FROM assessment_form_items WHERE form_id=? AND id IN (${placeholders})`,
      [form.id, ...itemIds]
    );
    if (items.length !== itemIds.length) throw new Error("部分异议项目不存在或不属于当前综测表");

    const [initialTasks] = await conn.execute(
      "SELECT * FROM assessment_review_tasks WHERE form_id=? AND stage IN ('assessment_member','initial') AND status IN ('approved','returned','rejected') ORDER BY completed_at DESC, id DESC LIMIT 1",
      [form.id]
    );
    if (!initialTasks.length) throw new Error("未找到原评价小组成员，暂不能发起异议");
    const originalTask = initialTasks[0];

    await conn.execute(
      `INSERT INTO assessment_review_tasks
        (batch_id, form_id, reviewer_id, reviewer_name, reviewer_no, reviewer_class_id, reviewer_class_name, target_class_name, status, stage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'objection')`,
      [form.batch_id, form.id, originalTask.reviewer_id, originalTask.reviewer_name, originalTask.reviewer_no, originalTask.reviewer_class_id, originalTask.reviewer_class_name, originalTask.target_class_name]
    );
    await conn.execute(
      `INSERT INTO assessment_batch_members (batch_id, student_id, assigned_by, status, assigned_at, removed_at)
       VALUES (?, ?, NULL, 'active', NOW(), NULL)
       ON DUPLICATE KEY UPDATE status='active', assigned_at=NOW(), removed_at=NULL`,
      [form.batch_id, originalTask.reviewer_id]
    );
    await syncLegacyMemberFlag(conn, originalTask.reviewer_id);

    for (const item of normalized) {
      await conn.execute(
        `INSERT INTO assessment_objections
          (batch_id, form_id, item_id, student_id, reason, status, original_reviewer_id)
         VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
        [form.batch_id, form.id, item.itemId, student.id, item.reason, originalTask.reviewer_id]
      );
    }

    await conn.execute(
      "UPDATE assessment_forms SET pre_objection_status=?, status='pending_objection_review', updated_at=NOW() WHERE id=?",
      [form.status, form.id]
    );
    await addLog(
      conn,
      student,
      "提交综测异议",
      form.student_name,
      `一次提交 ${normalized.length} 个异议项目：${normalized.map(item => item.itemId).join(",")}`
    );
    const [updated] = await conn.execute("SELECT * FROM assessment_forms WHERE id=?", [form.id]);
    return buildFormView(updated[0], student, conn);
  });
}

async function canReadForm(user, form, db = pool) {
  if (user.role === "student") {
    if (Number(form.student_id) === Number(user.id)) return true;
    if (!(await hasActiveBatchMember(db, form.batch_id, user.id))) return false;
    const [tasks] = await db.execute(
      "SELECT id FROM assessment_review_tasks WHERE form_id=? AND reviewer_id=? AND status <> 'cancelled' LIMIT 1",
      [form.id, user.id]
    );
    return tasks.length > 0;
  }
  if (user.role === "counselor") {
    if (!isInScope(user, form)) return false;
    if (form.status !== "pending_counselor") return true;
    const [tasks] = await db.execute(
      "SELECT id FROM assessment_review_tasks WHERE form_id=? AND reviewer_id=? AND stage='counselor' AND status='pending' LIMIT 1",
      [form.id, user.id]
    );
    return tasks.length > 0;
  }
  if (user.role === "student_affairs") {
    if (form.status !== "pending_student_affairs") return true;
    const [tasks] = await db.execute(
      "SELECT id FROM assessment_review_tasks WHERE form_id=? AND reviewer_id=? AND stage='student_affairs' AND status='pending' LIMIT 1",
      [form.id, user.id]
    );
    return tasks.length > 0;
  }
  return user.role === "admin";
}

async function buildFormView(form, viewer = null, db = pool) {
  const batch = await getBatchById(form.batch_id, db);
  const settings = await getSettings(db);
  const options = batchOptions(batch, settings);
  const [items] = await db.execute("SELECT * FROM assessment_form_items WHERE form_id=? ORDER BY sort_order, id", [form.id]);
  const [allRecords] = await db.execute("SELECT * FROM assessment_review_records WHERE form_id=? ORDER BY created_at ASC, id ASC", [form.id]);
  const [itemReviews] = await db.execute("SELECT * FROM assessment_item_reviews WHERE form_id=? ORDER BY created_at ASC, id ASC", [form.id]);
  const [objections] = await db.execute("SELECT * FROM assessment_objections WHERE form_id=? ORDER BY created_at ASC, id ASC", [form.id]);
  let taskSql = "SELECT * FROM assessment_review_tasks WHERE form_id=? AND status <> 'cancelled' ORDER BY assigned_at DESC, id DESC";
  const taskParams = [form.id];
  const ownerStudent = viewer?.role === "student" && Number(viewer.id) === Number(form.student_id);
  const assignedReviewer = viewer && ["student", "counselor", "student_affairs"].includes(viewer.role) && !ownerStudent;
  if (assignedReviewer) {
    taskSql = "SELECT * FROM assessment_review_tasks WHERE form_id=? AND reviewer_id=? AND status <> 'cancelled' ORDER BY assigned_at DESC, id DESC";
    taskParams.push(viewer.id);
  }
  const [tasks] = await db.execute(taskSql, taskParams);
  const activeTask = assignedReviewer ? tasks.find(task => task.status === "pending") || tasks[0] : null;
  const scores = parseJson(form.scores, { f1_basic_quality: 0, f2_course_learning: 0, f3_innovation_practice: 0, total: 0 });
  const wordDocument = await getWordDocumentMetadata(db, form);
  const evidenceIds = [...new Set(items.flatMap(item => normalizeIds(parseJson(item.evidence_ids, []))))];
  let evidenceMap = new Map();
  if (evidenceIds.length) {
    const placeholders = evidenceIds.map(() => "?").join(",");
    const [attachments] = await db.execute(
      `SELECT id, file_name, file_path, file_type, file_size FROM attachments WHERE id IN (${placeholders})`,
      evidenceIds
    );
    evidenceMap = new Map(attachments.map(file => [Number(file.id), {
      id: file.id,
      name: file.file_name,
      type: file.file_type || "文件",
      size: Number(file.file_size || 0),
      url: attachmentPublicUrl(file.file_path),
    }]));
  }
  const resultReleased = !!form.result_released_at && (isFinalStatus(form.status) || form.status === "pending_objection_review");
  const showReviewResult = !ownerStudent || resultReleased || String(form.status || "").startsWith("returned");
  const visibleRecords = showReviewResult ? allRecords : [];
  const visibleItemReviews = showReviewResult ? itemReviews : [];
  const objectionByItem = new Map(objections.map(item => [Number(item.item_id), item]));
  const normalizedItems = items.map(item => {
    const ids = normalizeIds(parseJson(item.evidence_ids, []));
    return {
      ...item,
      subKey: item.sub_key,
      evidence_ids: ids,
      evidence_files: ids.map(id => evidenceMap.get(id)).filter(Boolean),
      editable: !!item.editable,
      reviews: visibleItemReviews.filter(review => Number(review.item_id) === Number(item.id)),
      objection: ownerStudent || !viewer || ["admin", "counselor", "student_affairs"].includes(viewer?.role) || (viewer?.role === "student" && !ownerStudent)
        ? objectionByItem.get(Number(item.id)) || null
        : null,
    };
  });
  const groupedItems = FORM_STRUCTURE.map(section => ({
    ...section,
    score: Number(scores[section.scoreKey] || 0),
    children: section.children.map(child => ({
      ...child,
      items: normalizedItems.filter(item => item.section === section.key && item.sub_key === child.key),
    })),
  }));
  const level = form.manual_level || form.level || calculateLevel(scores.total, settings.gradeRules);
  const deadline = form.result_released_at ? addDays(form.result_released_at, options.objectionDays) : null;
  const reviewableItemIds = viewer && !ownerStudent
    ? await getReviewableItemIds(db, form, viewer, activeTask)
    : [];
  return {
    ...form,
    is_demo: !!form.is_demo,
    batch_title: batch?.title || form.batch_title || "",
    batch_status: batch?.status || "",
    scores,
    word_document: wordDocument,
    level,
    manual_level: form.manual_level || "",
    auto_level: calculateLevel(scores.total, settings.gradeRules),
    status_label: STATUS_LABEL[form.status] || form.status,
    items: normalizedItems,
    review_records: visibleRecords,
    item_reviews: visibleItemReviews,
    objections,
    review_tasks: tasks,
    grouped_items: groupedItems,
    review_stage: activeTask?.stage || "initial",
    reviewable_item_ids: reviewableItemIds,
    result_released: resultReleased,
    result_notice: resultReleased ? (form.status === "pending_objection_review" ? "异议已提交，正在由原评价小组成员复评" : "该批次评价链已完成，可以查看最终结果") : "",
    objection_deadline: deadline ? deadline.toISOString() : "",
    objection_submitted: objections.length > 0,
    can_raise_objection: !!(ownerStudent && resultReleased && isFinalStatus(form.status) && objections.length === 0 && Number(options.objectionDays || 0) > 0 && deadline && deadline.getTime() >= Date.now()),
    can_student_edit: canStudentEdit(form, batch, settings),
    can_student_submit: canStudentEdit(form, batch, settings),
    readonly_reason: readonlyReason(form, batch, settings),
  };
}

async function syncStudentSmartFillForm(student, batch) {
  const source = await getLatestSmartFillSource(student.id);
  return withTransaction(async conn => {
    const [existingRows] = await conn.execute(
      "SELECT * FROM assessment_forms WHERE student_id=? AND batch_id=? ORDER BY updated_at DESC, id DESC LIMIT 1 FOR UPDATE",
      [student.id, batch.id]
    );
    let form = existingRows[0] || null;

    // 旧版占位示例表不再参与任何流程；有真实智能填表结果时直接替换，没有时不展示。
    if (form?.is_demo) {
      await deleteFormCascade(conn, form.id);
      form = null;
    }

    if (!source) {
      return form ? buildFormView(form, student, conn) : null;
    }

    const settings = await getSettings(conn);
    const shouldCreate = !form;
    const shouldRefresh = !!form
      && form.status === "smart_ready"
      && Number(form.fill_result_id || 0) !== Number(source.fillResult.id);

    if (shouldCreate) {
      const [result] = await conn.execute(
        `INSERT INTO assessment_forms
          (batch_id, batch_title, student_id, student_name, student_no, college, major, grade,
           class_id, class_name, from_smart_fill, is_demo, fill_result_id, smart_fill_rule_set_id,
           smart_fill_synced_at, status, level, scores, personal_summary)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, ?, NOW(), 'smart_ready', ?, ?, '')`,
        [
          batch.id,
          batch.title || "",
          student.id,
          student.real_name || "",
          student.student_no || student.username || "",
          student.college || "",
          student.major || "",
          student.grade || "",
          student.class_id || null,
          student.class_name || "",
          source.fillResult.id,
          source.ruleSetId,
          calculateLevel(source.scores.total, settings.gradeRules),
          JSON.stringify(source.scores),
        ]
      );
      const [createdRows] = await conn.execute("SELECT * FROM assessment_forms WHERE id=?", [result.insertId]);
      form = createdRows[0];
    } else if (shouldRefresh) {
      await conn.execute(
        `UPDATE assessment_forms
         SET batch_title=?, student_name=?, student_no=?, college=?, major=?, grade=?, class_id=?, class_name=?,
             from_smart_fill=1, is_demo=0, fill_result_id=?, smart_fill_rule_set_id=?, smart_fill_synced_at=NOW(),
             scores=?, level=?, manual_level='', updated_at=NOW()
         WHERE id=?`,
        [
          batch.title || "",
          student.real_name || "",
          student.student_no || student.username || "",
          student.college || "",
          student.major || "",
          student.grade || "",
          student.class_id || null,
          student.class_name || "",
          source.fillResult.id,
          source.ruleSetId,
          JSON.stringify(source.scores),
          calculateLevel(source.scores.total, settings.gradeRules),
          form.id,
        ]
      );
      await conn.execute("DELETE FROM assessment_form_items WHERE form_id=?", [form.id]);
      const [updatedRows] = await conn.execute("SELECT * FROM assessment_forms WHERE id=?", [form.id]);
      form = updatedRows[0];
    }

    if (shouldCreate || shouldRefresh) {
      for (const item of source.items) {
        await conn.execute(
          `INSERT INTO assessment_form_items
            (form_id, section, sub_key, title, reason, score, evidence_ids, editable, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, JSON_ARRAY(), 1, ?)`,
          [form.id, item.section, item.subKey, item.title, item.reason, item.score, item.sortOrder]
        );
      }
      await addLog(
        conn,
        student,
        shouldCreate ? "导入智能填表综测表" : "刷新智能填表综测表",
        batch.title,
        `绑定智能填表 Word 结果 #${source.fillResult.id}，并写入 F1/F2/F3 明细`
      );
    }

    const [latestRows] = await conn.execute("SELECT * FROM assessment_forms WHERE id=?", [form.id]);
    return buildFormView(latestRows[0], student, conn);
  });
}

async function uploadStudentSupportMaterials(studentId, batchId, files = []) {
  if (!batchId) throw new Error('请先选择综测批次');
  if (!Array.isArray(files) || !files.length) throw new Error('请选择需要添加的支撑材料');
  if (files.length > 10) throw new Error('单次最多上传 10 个支撑材料');

  const student = await getUser(studentId);
  if (student.role !== 'student') throw new Error('只有学生可以添加自己的支撑材料');
  assertProfileComplete(student, '添加支撑材料');

  return withTransaction(async conn => {
    const [forms] = await conn.execute(
      'SELECT * FROM assessment_forms WHERE student_id=? AND batch_id=? ORDER BY updated_at DESC, id DESC LIMIT 1 FOR UPDATE',
      [student.id, Number(batchId)]
    );
    if (!forms.length) throw new Error('当前批次暂无综测表');
    const form = forms[0];
    const batch = await getBatchById(form.batch_id, conn);
    const settings = await getSettings(conn);
    if (!canStudentEdit(form, batch, settings)) throw new Error(readonlyReason(form, batch, settings));

    const [materialResult] = await conn.execute(
      'INSERT INTO materials (user_id, title, category) VALUES (?, ?, ?)',
      [student.id, `${batch?.title || form.batch_title || '综测'}支撑材料`, 'module3_assessment']
    );
    const uploaded = [];
    for (const file of files) {
      const originalName = String(file.originalname || file.filename || '支撑材料');
      const decodedName = Buffer.from(originalName, 'latin1').toString('utf8');
      const safeName = decodedName.includes('�') ? originalName : decodedName;
      const [attachmentResult] = await conn.execute(
        'INSERT INTO attachments (material_id, file_name, file_path, file_type, file_size) VALUES (?, ?, ?, ?, ?)',
        [materialResult.insertId, safeName, file.filename, file.mimetype || '', Number(file.size || 0)]
      );
      uploaded.push({
        id: attachmentResult.insertId,
        name: safeName,
        type: file.mimetype || '文件',
        size: Number(file.size || 0),
        url: attachmentPublicUrl(file.filename),
      });
    }
    await addLog(conn, student, '添加综测支撑材料', form.student_name, `上传 ${uploaded.length} 个支撑材料，等待保存到具体综测项目`);
    return { material_id: materialResult.insertId, files: uploaded };
  });
}

async function getSmartResult(studentId, batchId) {
  if (!batchId) throw new Error("请先选择综测批次");
  const student = await getUser(studentId);
  if (student.role !== "student") throw new Error("只有学生可以查看自己的综测信息");
  assertProfileComplete(student, "查看综测信息");
  const batch = await getBatchById(batchId);
  if (!batch || batch.college !== student.college || batch.grade !== student.grade) {
    throw new Error("该批次不属于当前学生所在学院或年级");
  }
  return syncStudentSmartFillForm(student, batch);
}

async function updateSmartResult(studentId, payload) {
  if (!payload?.batch_id) throw new Error("请先选择综测批次");
  const student = await getUser(studentId);
  assertProfileComplete(student, "填写综测");
  return withTransaction(async conn => {
    const [forms] = await conn.execute(
      "SELECT * FROM assessment_forms WHERE student_id=? AND batch_id=? ORDER BY updated_at DESC, id DESC LIMIT 1 FOR UPDATE",
      [student.id, payload.batch_id]
    );
    if (!forms.length) throw new Error("当前批次暂无智能填表结果");
    const form = forms[0];
    const batch = await getBatchById(form.batch_id, conn);
    const settings = await getSettings(conn);
    if (!canStudentEdit(form, batch, settings)) throw new Error(readonlyReason(form, batch, settings));

    let scores = parseJson(form.scores, {});
    if (Array.isArray(payload.items)) {
      await validateStudentEvidenceIds(conn, student.id, payload.items);
      await conn.execute("DELETE FROM assessment_form_items WHERE form_id=?", [form.id]);
      let f1 = 0;
      let f2 = 0;
      let f3 = 0;
      for (let index = 0; index < payload.items.length; index += 1) {
        const input = payload.items[index] || {};
        const section = FORM_STRUCTURE.find(item => item.key === input.section) || FORM_STRUCTURE[2];
        const child = section.children.find(item => item.key === input.subKey) || section.children[0];
        const score = Number(input.score || 0);
        if (section.key === "F1") f1 += score;
        if (section.key === "F2") f2 += score;
        if (section.key === "F3") f3 += score;
        await conn.execute(
          `INSERT INTO assessment_form_items
            (form_id, section, sub_key, title, reason, score, evidence_ids, editable, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [form.id, section.key, child.key, String(input.title || ""), String(input.reason || ""), score, JSON.stringify(normalizeIds(input.evidence_ids)), input.editable === false ? 0 : 1, index]
        );
      }
      scores = {
        ...scores,
        f1_basic_quality: f1,
        f2_course_learning: f2,
        f3_innovation_practice: f3,
        total: Number((f1 * 0.1 + f2 * 0.65 + f3 * 0.25).toFixed(2)),
      };
    }
    const level = calculateLevel(scores.total, settings.gradeRules);
    await conn.execute(
      "UPDATE assessment_forms SET personal_summary=?, scores=?, level=?, manual_level='', updated_at=NOW() WHERE id=?",
      [payload.personal_summary ?? form.personal_summary ?? "", JSON.stringify(scores), level, form.id]
    );
    await addLog(conn, student, "保存综测信息", form.student_name, "学生在信息管理页保存当前批次综测表");
    const [updated] = await conn.execute("SELECT * FROM assessment_forms WHERE id=?", [form.id]);
    return buildFormView(updated[0], student, conn);
  });
}

async function selectWorkflowReviewer(conn, form, stage) {
  const role = stage === "counselor" ? "counselor" : "student_affairs";
  let candidates = [];
  if (role === "counselor") {
    const [rows] = await conn.execute(
      `SELECT u.id, u.username, u.real_name, u.student_no, u.college, u.grade,
              s.college AS scope_college, s.grade AS scope_grade, s.class_ids AS scope_class_ids
       FROM users u
       LEFT JOIN counselor_scopes s ON s.counselor_id=u.id
       WHERE u.role='counselor'`
    );
    candidates = rows.filter(row => {
      const college = row.scope_college || row.college || "";
      const grade = row.scope_grade || row.grade || "";
      const classIds = normalizeIds(parseJson(row.scope_class_ids, []));
      return college === String(form.college || "")
        && grade === String(form.grade || "")
        && (!classIds.length || classIds.includes(Number(form.class_id)));
    });
  } else {
    const [rows] = await conn.execute(
      "SELECT id, username, real_name, student_no FROM users WHERE role='student_affairs'"
    );
    candidates = rows;
  }
  if (!candidates.length) {
    throw new Error(role === "counselor" ? "当前没有符合管辖范围的辅导员账号" : "当前没有可用的学生工作处账号");
  }
  for (const candidate of candidates) {
    const [[countRow]] = await conn.execute(
      `SELECT COUNT(*) AS count FROM assessment_review_tasks
       WHERE reviewer_id=? AND batch_id=? AND stage=? AND status <> 'cancelled'`,
      [candidate.id, form.batch_id, stage]
    );
    candidate.task_count = Number(countRow.count || 0);
  }
  candidates.sort((a, b) => a.task_count - b.task_count || Number(a.id) - Number(b.id));
  return candidates[0];
}

async function assignWorkflowTask(conn, form, stage) {
  const [existing] = await conn.execute(
    "SELECT * FROM assessment_review_tasks WHERE form_id=? AND stage=? AND status='pending' ORDER BY id DESC LIMIT 1",
    [form.id, stage]
  );
  if (existing.length) return existing[0];
  const reviewer = await selectWorkflowReviewer(conn, form, stage);
  const reviewerName = reviewer.real_name || reviewer.username || "";
  await conn.execute(
    `INSERT INTO assessment_review_tasks
      (batch_id, form_id, reviewer_id, reviewer_name, reviewer_no, reviewer_class_id, reviewer_class_name, target_class_name, status, stage)
     VALUES (?, ?, ?, ?, ?, NULL, '', ?, 'pending', ?)`,
    [form.batch_id, form.id, reviewer.id, reviewerName, reviewer.student_no || reviewer.username || "", form.class_name || "", stage]
  );
  const [created] = await conn.execute(
    "SELECT * FROM assessment_review_tasks WHERE form_id=? AND stage=? AND status='pending' ORDER BY id DESC LIMIT 1",
    [form.id, stage]
  );
  return created[0];
}

async function ensurePendingWorkflowTasks() {
  const [forms] = await pool.execute(
    `SELECT f.id
     FROM assessment_forms f
     LEFT JOIN assessment_review_tasks t
       ON t.form_id=f.id AND t.status='pending'
      AND ((f.status='pending_counselor' AND t.stage='counselor')
        OR (f.status='pending_student_affairs' AND t.stage='student_affairs'))
     WHERE f.status IN ('pending_counselor','pending_student_affairs') AND t.id IS NULL
     ORDER BY f.id`
  );
  for (const item of forms) {
    try {
      await withTransaction(async conn => {
        const [locked] = await conn.execute(
          "SELECT * FROM assessment_forms WHERE id=? AND status IN ('pending_counselor','pending_student_affairs') LIMIT 1 FOR UPDATE",
          [item.id]
        );
        if (!locked.length) return;
        const form = locked[0];
        const stage = form.status === "pending_counselor" ? "counselor" : "student_affairs";
        await assignWorkflowTask(conn, form, stage);
      });
    } catch (_) {
      // 没有符合条件的账号时保留待评状态，由管理员补充账号或辅导员范围后再次自动分配。
    }
  }
}

async function selectReviewer(conn, form) {
  const [assignments] = await conn.execute(
    "SELECT * FROM assessment_review_assignments WHERE batch_id=? AND target_class_id=? LIMIT 1",
    [form.batch_id, form.class_id]
  );
  if (!assignments.length) throw new Error("该班级尚未配置跨班互评关系，请联系辅导员或管理员");
  const assignment = assignments[0];
  if (Number(assignment.target_class_id) === Number(assignment.reviewer_class_id)) throw new Error("跨班互评不支持本班评本班");
  const [members] = await conn.execute(
    `SELECT u.id, u.real_name, u.username, u.student_no, u.class_id, u.class_name,
            COUNT(t.id) AS task_count
     FROM users u
     JOIN assessment_batch_members bm ON bm.student_id=u.id AND bm.batch_id=? AND bm.status='active'
     LEFT JOIN assessment_review_tasks t
       ON t.reviewer_id=u.id AND t.batch_id=? AND t.status <> 'cancelled'
     WHERE u.role='student' AND u.class_id=?
     GROUP BY u.id
     ORDER BY task_count ASC, u.id ASC
     LIMIT 1`,
    [form.batch_id, form.batch_id, assignment.reviewer_class_id]
  );
  if (!members.length) throw new Error("评价班级暂无当前批次可用评价小组成员，请辅导员先为该班成员赋予评价小组身份");
  return { assignment, reviewer: members[0] };
}

async function submitSmartResult(studentId, payload = {}) {
  if (!payload.batch_id) throw new Error("请先选择综测批次");
  const student = await getUser(studentId);
  assertProfileComplete(student, "提交综测");
  return withTransaction(async conn => {
    const [forms] = await conn.execute(
      "SELECT * FROM assessment_forms WHERE student_id=? AND batch_id=? ORDER BY updated_at DESC, id DESC LIMIT 1 FOR UPDATE",
      [student.id, payload.batch_id]
    );
    if (!forms.length) throw new Error("当前批次暂无智能填表结果");
    const form = forms[0];
    const batch = await getBatchById(form.batch_id, conn);
    const settings = await getSettings(conn);
    if (!canStudentEdit(form, batch, settings)) throw new Error(readonlyReason(form, batch, settings));
    const [[itemCount]] = await conn.execute("SELECT COUNT(*) AS count FROM assessment_form_items WHERE form_id=?", [form.id]);
    if (!Number(itemCount.count)) throw new Error("请至少保留一项综测内容后再提交");
    const { assignment, reviewer } = await selectReviewer(conn, form);
    await conn.execute("UPDATE assessment_review_tasks SET status='cancelled' WHERE form_id=? AND status='pending'", [form.id]);
    await conn.execute(
      `INSERT INTO assessment_review_tasks
        (batch_id, form_id, reviewer_id, reviewer_name, reviewer_no, reviewer_class_id, reviewer_class_name, target_class_name, status, stage)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'assessment_member')`,
      [form.batch_id, form.id, reviewer.id, reviewer.real_name || reviewer.username || "", reviewer.student_no || "", reviewer.class_id, reviewer.class_name || assignment.reviewer_class_name, form.class_name || assignment.target_class_name]
    );
    await conn.execute("UPDATE assessment_forms SET status='pending_class_committee', result_released_at=NULL, pre_objection_status='', updated_at=NOW() WHERE id=?", [form.id]);
    await addLog(conn, student, "提交综测表", batch.title, `系统已按工作量均分给 ${reviewer.real_name || reviewer.id}`);
    const [updated] = await conn.execute("SELECT * FROM assessment_forms WHERE id=?", [form.id]);
    return buildFormView(updated[0], student, conn);
  });
}

async function listFormsByUser(user) {
  let sql = "SELECT * FROM assessment_forms";
  const params = [];
  if (user.role === "student") {
    sql += " WHERE student_id=?";
    params.push(user.id);
  } else if (user.role === "counselor") {
    if (!user.scope?.college || !user.scope?.grade) return [];
    sql += " WHERE college=? AND grade=?";
    params.push(user.scope.college, user.scope.grade);
    const classIds = normalizeIds(user.scope.class_ids);
    if (classIds.length) {
      sql += ` AND class_id IN (${classIds.map(() => "?").join(",")})`;
      params.push(...classIds);
    }
  } else if (!["admin", "student_affairs"].includes(user.role)) {
    return [];
  }
  sql += " ORDER BY updated_at DESC, id DESC";
  const [rows] = await pool.execute(sql, params);
  return Promise.all(rows.map(row => buildFormView(row, user)));
}

async function getFormDetail(formId, user) {
  const [rows] = await pool.execute("SELECT * FROM assessment_forms WHERE id=? LIMIT 1", [formId]);
  if (!rows.length) throw new Error("评价表不存在");
  if (!(await canReadForm(user, rows[0]))) throw new Error("无权查看该综测表");
  return buildFormView(rows[0], user);
}

async function getFormWordSource(formId, user) {
  const [forms] = await pool.execute("SELECT * FROM assessment_forms WHERE id=? LIMIT 1", [formId]);
  if (!forms.length) throw new Error("评价表不存在");
  const form = forms[0];
  if (!(await canReadForm(user, form))) throw new Error("无权查看该综测表");
  if (!form.fill_result_id) throw new Error("当前综测表尚未绑定智能填表 Word 文档");
  const [results] = await pool.execute(
    "SELECT * FROM fill_results WHERE id=? AND user_id=? LIMIT 1",
    [form.fill_result_id, form.student_id]
  );
  if (!results.length) throw new Error("智能填表 Word 记录不存在或已失效");
  const filePath = path.join(__dirname, "../../../uploads", String(results[0].result_path || ""));
  if (!results[0].result_path || !fs.existsSync(filePath)) throw new Error("智能填表 Word 文件不存在或已被移除");
  return {
    path: filePath,
    name: results[0].original_name || "综测表_智能填表结果.docx",
  };
}

async function getPendingReviews(user) {
  await ensurePendingWorkflowTasks();
  let sql;
  let params = [];
  if (user.role === "student") {
    sql = `SELECT DISTINCT f.* FROM assessment_forms f
           JOIN assessment_review_tasks t ON t.form_id=f.id
           JOIN assessment_batch_members bm ON bm.batch_id=f.batch_id AND bm.student_id=? AND bm.status='active'
           WHERE f.status IN ('pending_class_committee','pending_objection_review') AND t.reviewer_id=? AND t.status='pending'`;
    params = [user.id, user.id];
  } else if (user.role === "counselor") {
    sql = `SELECT DISTINCT f.* FROM assessment_forms f
           JOIN assessment_review_tasks t ON t.form_id=f.id
           WHERE f.status='pending_counselor' AND t.reviewer_id=? AND t.stage='counselor' AND t.status='pending'`;
    params = [user.id];
  } else if (user.role === "student_affairs") {
    sql = `SELECT DISTINCT f.* FROM assessment_forms f
           JOIN assessment_review_tasks t ON t.form_id=f.id
           WHERE f.status='pending_student_affairs' AND t.reviewer_id=? AND t.stage='student_affairs' AND t.status='pending'`;
    params = [user.id];
  } else {
    return [];
  }
  sql += " ORDER BY updated_at DESC, id DESC";
  const [rows] = await pool.execute(sql, params);
  return Promise.all(rows.map(row => buildFormView(row, user)));
}

async function setFormLevel(formId, level, operator) {
  const [rows] = await pool.execute("SELECT * FROM assessment_forms WHERE id=? LIMIT 1", [formId]);
  if (!rows.length) throw new Error("评价表不存在");
  if (!(await canReadForm(operator, rows[0]))) throw new Error("无权调整该综测表等级");
  if (operator.role === "student" && !(await hasActiveBatchMember(pool, rows[0].batch_id, operator.id))) throw new Error("当前学生不是该批次评价小组成员");
  await withTransaction(async conn => {
    await conn.execute("UPDATE assessment_forms SET manual_level=?, updated_at=NOW() WHERE id=?", [level || "", formId]);
    await addLog(conn, operator, "调整测评等级", rows[0].student_name, `等级设置为 ${level || "自动"}`);
  });
  const [updated] = await pool.execute("SELECT * FROM assessment_forms WHERE id=?", [formId]);
  return buildFormView(updated[0], operator);
}

async function reviewForm(formId, reviewer, data = {}) {
  const action = data.action;
  const comment = String(data.comment || "");
  const level = String(data.level || "");
  const itemReviews = Array.isArray(data.item_reviews) ? data.item_reviews : [];
  if (!["approve", "return", "reject"].includes(action)) throw new Error("无效评价操作");
  return withTransaction(async conn => {
    const [rows] = await conn.execute("SELECT * FROM assessment_forms WHERE id=? LIMIT 1 FOR UPDATE", [formId]);
    if (!rows.length) throw new Error("评价表不存在");
    const form = rows[0];
    if (!(await canReadForm(reviewer, form, conn))) throw new Error("无权评价该综测表");
    const settings = await getSettings(conn);
    const batch = await getBatchById(form.batch_id, conn);
    const options = batchOptions(batch, settings);
    if (options.requireReviewerComment && !comment.trim()) throw new Error("请填写评价意见");

    let nextStatus = "";
    let reviewerRole = reviewer.role;
    let reviewerName = reviewer.real_name || ROLE_LABEL[reviewer.role] || reviewer.username;
    let actorLabel = ROLE_LABEL[reviewer.role] || "评价人员";
    let task = null;
    let stage = "initial";

    if (reviewer.role === "student") {
      if (!(await hasActiveBatchMember(conn, form.batch_id, reviewer.id))) throw new Error("当前学生未被赋予该批次评价小组身份");
      const [tasks] = await conn.execute(
        "SELECT * FROM assessment_review_tasks WHERE form_id=? AND reviewer_id=? AND status='pending' ORDER BY id DESC LIMIT 1 FOR UPDATE",
        [form.id, reviewer.id]
      );
      if (!tasks.length) throw new Error("你只能评价分配给自己的待评表单");
      task = tasks[0];
      stage = task.stage || "initial";
      if (stage === "objection") {
        if (form.status !== "pending_objection_review") throw new Error("当前表单不在异议复评状态");
        if (action !== "approve") throw new Error("异议复评请逐项填写结论后提交复评结果");
      } else if (form.status !== "pending_class_committee") {
        throw new Error(`当前状态为“${STATUS_LABEL[form.status] || form.status}”，不属于评价小组待评价范围`);
      }
      reviewerRole = "assessment_member";
      reviewerName = `${reviewer.real_name || reviewer.username}（评价小组）`;
      actorLabel = stage === "objection" ? "评价小组异议复评" : "评价小组";
    } else if (reviewer.role === "counselor") {
      if (!options.requireCounselorReview) throw new Error("该批次未启用辅导员评价环节");
      if (form.status !== "pending_counselor") throw new Error(`当前状态为“${STATUS_LABEL[form.status] || form.status}”，不属于辅导员待评价范围`);
      if (!isInScope(reviewer, form)) throw new Error("只能评价管辖范围内的学生");
      const [tasks] = await conn.execute(
        "SELECT * FROM assessment_review_tasks WHERE form_id=? AND reviewer_id=? AND stage='counselor' AND status='pending' ORDER BY id DESC LIMIT 1 FOR UPDATE",
        [form.id, reviewer.id]
      );
      if (!tasks.length) throw new Error("该表单未分配给当前辅导员");
      task = tasks[0];
      stage = "counselor";
      nextStatus = nextStatusAfter("counselor", action, options);
    } else if (reviewer.role === "student_affairs") {
      if (!options.requireStudentAffairsReview) throw new Error("该批次未启用学生工作处评价环节");
      if (form.status !== "pending_student_affairs") throw new Error(`当前状态为“${STATUS_LABEL[form.status] || form.status}”，不属于学生工作处待评价范围`);
      const [tasks] = await conn.execute(
        "SELECT * FROM assessment_review_tasks WHERE form_id=? AND reviewer_id=? AND stage='student_affairs' AND status='pending' ORDER BY id DESC LIMIT 1 FOR UPDATE",
        [form.id, reviewer.id]
      );
      if (!tasks.length) throw new Error("该表单未分配给当前学生工作处账号");
      task = tasks[0];
      stage = "student_affairs";
      nextStatus = nextStatusAfter("student_affairs", action, options);
    } else {
      throw new Error("当前角色不可进行评价");
    }

    const reviewableIds = await getReviewableItemIds(conn, form, reviewer, task);
    if (stage === "objection" && !reviewableIds.length) throw new Error("当前没有待处理的异议加分项");
    await saveItemReviews(conn, form, reviewer, reviewerRole, stage, itemReviews, reviewableIds, action);

    if (task) {
      const taskStatus = action === "approve" ? "approved" : action === "return" ? "returned" : "rejected";
      await conn.execute(
        "UPDATE assessment_review_tasks SET status=?, action=?, comment=?, completed_at=NOW() WHERE id=?",
        [taskStatus, action, comment, task.id]
      );
    }
    if (reviewer.role === "student") {
      if (stage === "objection") {
        nextStatus = isFinalStatus(form.pre_objection_status) ? form.pre_objection_status : "approved";
        const reviewMap = new Map(itemReviews.map(item => [Number(item.item_id), item]));
        const [pendingObjections] = await conn.execute(
          "SELECT id, item_id FROM assessment_objections WHERE form_id=? AND status='pending' FOR UPDATE",
          [form.id]
        );
        for (const objection of pendingObjections) {
          const itemReview = reviewMap.get(Number(objection.item_id)) || {};
          const itemAction = itemReview.action === "reject" ? "不符合" : itemReview.action === "return" ? "需修改" : "符合";
          const resolution = String(itemReview.reason || comment || `异议项复评结论：${itemAction}`).trim();
          await conn.execute(
            `UPDATE assessment_objections
             SET status='resolved', resolution=?, resolved_by=?, resolved_at=NOW()
             WHERE id=?`,
            [resolution, reviewer.id, objection.id]
          );
        }
      } else {
        nextStatus = nextStatusAfter("assessment_member", action, options);
      }
    }

    let finalLevel = form.manual_level || form.level || "";
    if (["student", "counselor"].includes(reviewer.role) && action === "approve" && level) finalLevel = level;
    const actionLabel = stage === "objection"
      ? "异议复评完成"
      : (action === "approve" ? "通过" : action === "return" ? "退回修改" : "不予认定");
    await conn.execute(
      `INSERT INTO assessment_review_records
        (form_id, reviewer_role, reviewer_name, action, action_label, level, comment)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [form.id, reviewerRole, reviewerName, action, actionLabel, finalLevel, comment]
    );
    let nextTask = null;
    if (nextStatus === "pending_counselor") nextTask = await assignWorkflowTask(conn, form, "counselor");
    if (nextStatus === "pending_student_affairs") nextTask = await assignWorkflowTask(conn, form, "student_affairs");
    const releasedAtSql = isFinalStatus(nextStatus) ? "COALESCE(result_released_at, NOW())" : "NULL";
    const preObjection = stage === "objection" ? "''" : "pre_objection_status";
    await conn.execute(
      `UPDATE assessment_forms
       SET status=?, manual_level=?, result_released_at=${releasedAtSql}, pre_objection_status=${preObjection}, updated_at=NOW()
       WHERE id=?`,
      [nextStatus, finalLevel, form.id]
    );
    const assignmentNote = nextTask ? `；下一环节已分配给 ${nextTask.reviewer_name}` : "";
    await addLog(conn, reviewer, `${actorLabel}评价`, form.student_name, `${actionLabel}：${comment || "无意见"}${assignmentNote}`);
    await expireBatchMembershipsIfComplete(conn, form.batch_id);
    const [updated] = await conn.execute("SELECT * FROM assessment_forms WHERE id=?", [form.id]);
    return buildFormView(updated[0], reviewer, conn);
  });
}

async function getStatistics(query = {}, user = null) {
  await ensurePendingWorkflowTasks();
  let where = "1=1";
  const params = [];
  if (query.batch_id) {
    where += " AND f.batch_id=?";
    params.push(Number(query.batch_id));
  }
  if (user?.role === "counselor") {
    if (!user.scope?.college || !user.scope?.grade) return emptyStatistics();
    where += " AND f.college=? AND f.grade=?";
    params.push(user.scope.college, user.scope.grade);
    const classIds = normalizeIds(user.scope.class_ids);
    if (classIds.length) {
      where += ` AND f.class_id IN (${classIds.map(() => "?").join(",")})`;
      params.push(...classIds);
    }
  } else if (user?.role === "student") {
    where += " AND EXISTS (SELECT 1 FROM assessment_review_tasks tx JOIN assessment_batch_members bm ON bm.batch_id=tx.batch_id AND bm.student_id=? AND bm.status='active' WHERE tx.form_id=f.id AND tx.reviewer_id=? AND tx.status <> 'cancelled')";
    params.push(user.id, user.id);
  }
  const [forms] = await pool.execute(`SELECT f.* FROM assessment_forms f WHERE ${where} ORDER BY f.updated_at DESC`, params);
  const settings = await getSettings();
  const rows = [];
  for (const form of forms) {
    const [tasks] = await pool.execute(
      "SELECT reviewer_name FROM assessment_review_tasks WHERE form_id=? AND status <> 'cancelled' ORDER BY assigned_at DESC, id DESC",
      [form.id]
    );
    const scores = parseJson(form.scores, {});
    rows.push({
      id: form.id,
      batch_id: form.batch_id,
      batch_title: form.batch_title || (await getBatchById(form.batch_id))?.title || "",
      college: form.college,
      grade: form.grade,
      student_name: form.student_name,
      student_no: form.student_no,
      class_name: form.class_name,
      reviewer_names: tasks.map(task => task.reviewer_name).filter(Boolean).join("、") || "未分配",
      total_score: Number(scores.total || 0),
      level: form.manual_level || form.level || calculateLevel(scores.total, settings.gradeRules),
      status: form.status,
      status_label: STATUS_LABEL[form.status] || form.status,
    });
  }
  const [taskRows] = await pool.execute(
    `SELECT t.status FROM assessment_review_tasks t
     JOIN assessment_forms f ON f.id=t.form_id
     WHERE t.status <> 'cancelled' AND ${where}`,
    params
  );
  const [[studentCount]] = await pool.execute("SELECT COUNT(*) AS count FROM users WHERE role='student'");
  return {
    total_students: Number(studentCount.count || 0),
    submitted: forms.filter(form => form.status !== "smart_ready").length,
    approved: forms.filter(form => form.status === "approved").length,
    rejected: forms.filter(form => form.status === "rejected").length,
    returned: forms.filter(form => String(form.status).startsWith("returned")).length,
    pending_class_committee: forms.filter(form => form.status === "pending_class_committee").length,
    pending_counselor: forms.filter(form => form.status === "pending_counselor").length,
    pending_student_affairs: forms.filter(form => form.status === "pending_student_affairs").length,
    pending_objection_review: forms.filter(form => form.status === "pending_objection_review").length,
    task_total: taskRows.length,
    task_pending: taskRows.filter(task => task.status === "pending").length,
    task_done: taskRows.filter(task => ["approved", "returned", "rejected"].includes(task.status)).length,
    rows,
  };
}

function emptyStatistics() {
  return {
    total_students: 0,
    submitted: 0,
    approved: 0,
    rejected: 0,
    returned: 0,
    pending_class_committee: 0,
    pending_counselor: 0,
    pending_student_affairs: 0,
    pending_objection_review: 0,
    task_total: 0,
    task_pending: 0,
    task_done: 0,
    rows: [],
  };
}

async function exportCsv(query, user) {
  const stats = await getStatistics(query, user);
  const rows = [
    ["批次", "学院", "年级", "学生姓名", "学号", "班级", "评测人", "综合分", "等级", "当前状态"],
    ...stats.rows.map(row => [row.batch_title, row.college, row.grade, row.student_name, row.student_no, row.class_name, row.reviewer_names, row.total_score, row.level, row.status_label]),
  ];
  return "\ufeff" + rows.map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
}

async function getLogs() {
  const [rows] = await pool.execute("SELECT * FROM assessment_operation_logs ORDER BY created_at DESC, id DESC LIMIT 500");
  return rows;
}

module.exports = {
  ROLE_LABEL,
  STATUS_LABEL,
  FORM_STRUCTURE,
  ensureClass,
  getUser,
  updateUserProfile,
  missingProfileFields,
  getSettings,
  updateSettings,
  listBatches,
  listStudentBatches,
  createBatch,
  updateBatch,
  updateBatchStatus,
  deleteBatch,
  getScopeOptions,
  updateCounselorScope,
  listStudents,
  setAssessmentMember,
  uploadStudentSupportMaterials,
  getSmartResult,
  updateSmartResult,
  submitSmartResult,
  listFormsByUser,
  getFormDetail,
  getFormWordSource,
  getPendingReviews,
  setFormLevel,
  reviewForm,
  submitObjection,
  getStatistics,
  exportCsv,
  getLogs,
};
