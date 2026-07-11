const ROLE_LABEL = {
  student: "学生",
  counselor: "辅导员",
  student_affairs: "学工办",
  admin: "管理员",
};

const STATUS_LABEL = {
  smart_ready: "智能填表待提交",
  pending_class_committee: "待综测成员评价",
  returned_by_class_committee: "综测成员退回",
  pending_counselor: "待辅导员评价",
  returned_by_counselor: "辅导员退回",
  pending_student_affairs: "待学工办评价",
  returned_by_student_affairs: "学工办退回",
  approved: "认定通过",
  rejected: "不予认定",
};

let nextId = 3000;
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const clone = (data) => JSON.parse(JSON.stringify(data));

const classes = [
  { id: 1, name: "计科2401班", college: "信息科学与工程学院", grade: "2024级" },
  { id: 2, name: "计科2402班", college: "信息科学与工程学院", grade: "2024级" },
  { id: 3, name: "软工2301班", college: "信息科学与工程学院", grade: "2023级" },
  { id: 4, name: "法学2401班", college: "法学院", grade: "2024级" },
  { id: 6, name: "信工2401测试班", college: "信息工程学院", grade: "2024级" },
];

const users = [
  { id: 1, username: "student", password: "123456", role: "student", real_name: "张同学", student_no: "20240001", college: "信息科学与工程学院", class_id: 1, class_name: "计科2401班", grade: "2024级", enrollment_grade: "2024级", major: "计算机科学与技术", is_assessment_member: false },
  { id: 9, username: "student2", password: "123456", role: "student", real_name: "李同学", student_no: "20240002", college: "信息科学与工程学院", class_id: 1, class_name: "计科2401班", grade: "2024级", enrollment_grade: "2024级", major: "计算机科学与技术", is_assessment_member: false },
  { id: 10, username: "member1", password: "123456", role: "student", real_name: "王同学", student_no: "20240021", college: "信息科学与工程学院", class_id: 2, class_name: "计科2402班", grade: "2024级", enrollment_grade: "2024级", major: "计算机科学与技术", is_assessment_member: true },
  { id: 11, username: "member2", password: "123456", role: "student", real_name: "赵同学", student_no: "20240022", college: "信息科学与工程学院", class_id: 2, class_name: "计科2402班", grade: "2024级", enrollment_grade: "2024级", major: "计算机科学与技术", is_assessment_member: true },
  { id: 12, username: "student2023", password: "123456", role: "student", real_name: "陈同学", student_no: "20230011", college: "信息科学与工程学院", class_id: 3, class_name: "软工2301班", grade: "2023级", enrollment_grade: "2023级", major: "软件工程", is_assessment_member: false },
  { id: 13, username: "testinfo1", password: "123456", role: "student", real_name: "测试甲", student_no: "20240091", college: "信息工程学院", class_id: 6, class_name: "信工2401测试班", grade: "2024级", enrollment_grade: "2024级", major: "信息工程", is_assessment_member: false },
  { id: 14, username: "testinfo2", password: "123456", role: "student", real_name: "测试乙", student_no: "20240092", college: "信息工程学院", class_id: 6, class_name: "信工2401测试班", grade: "2024级", enrollment_grade: "2024级", major: "信息工程", is_assessment_member: false },
  { id: 2, username: "admin", password: "123456", role: "admin", real_name: "管理员" },
  { id: 4, username: "counselor", password: "123456", role: "counselor", real_name: "辅导员", scope: { college: "信息科学与工程学院", grade: "2024级", class_ids: [] } },
  { id: 5, username: "affairs", password: "123456", role: "student_affairs", real_name: "学工办" },
];

const formStructure = [
  { key: "F1", title: "F1 基本素质评分", weight: "10%", scoreKey: "f1_basic_quality", children: [
    { key: "A1", title: "思想政治表现A1" },
    { key: "A2", title: "道德品质修养A2" },
    { key: "A3", title: "学习态度作风A3" },
    { key: "A4", title: "组织纪律观念A4" },
    { key: "A5", title: "身心健康素质A5" },
  ] },
  { key: "F2", title: "F2 课程学习成绩评分", weight: "65%", scoreKey: "f2_course_learning", children: [
    { key: "COURSE", title: "课程成绩" },
  ] },
  { key: "F3", title: "F3 创新素质与实践能力评分", weight: "25%", scoreKey: "f3_innovation_practice", children: [
    { key: "B1", title: "职业技能类B1" },
    { key: "B2", title: "学科竞赛类B2" },
    { key: "B3", title: "科研学术活动类B3" },
    { key: "B4", title: "文学艺术创作与宣传报道类B4" },
    { key: "B5", title: "社会工作类B5" },
    { key: "B6", title: "社会实践类B6" },
    { key: "B7", title: "文体艺术活动类B7" },
    { key: "B8", title: "劳育类B8" },
  ] },
];

const settings = {
  gradeRules: [
    { grade: "优", min: 85 },
    { grade: "良", min: 75 },
    { grade: "合格", min: 60 },
    { grade: "不合格", min: 0 },
  ],
  submitDeadline: "2026-07-25 23:59:59",
  allowStudentEdit: true,
  allowReturnEdit: true,
  requireReviewerComment: false,
  publishNotice: "请选择对应学年综测批次，确认智能填表结果后提交。",
};

const batches = [
  {
    id: 101,
    school_year: "2025-2026",
    title: "2025-2026学年综测",
    college: "信息科学与工程学院",
    grade: "2024级",
    description: "面向信息科学与工程学院2024级学生的年度综合素质测评。",
    start_time: "2026-07-01 08:00:00",
    end_time: settings.submitDeadline,
    requirements: "学生先选择本批次，再确认智能填表结果并提交。",
    status: "published",
    created_by: 2,
    creator_name: "管理员",
    options: { allowStudentEdit: true, allowReturnEdit: true, requireReviewerComment: false },
    review_assignments: [
      { id: 901, target_class_id: 1, target_class_name: "计科2401班", reviewer_class_id: 2, reviewer_class_name: "计科2402班", reviewer_ids: [10, 11] },
      { id: 902, target_class_id: 2, target_class_name: "计科2402班", reviewer_class_id: 1, reviewer_class_name: "计科2401班", reviewer_ids: [] },
    ],
    created_at: "2026-07-09 09:00:00",
    updated_at: "2026-07-09 09:00:00",
  },
  {
    id: 102,
    school_year: "2024-2025",
    title: "2024-2025学年综测",
    college: "信息科学与工程学院",
    grade: "2024级",
    description: "历史批次，仅用于展示按时间倒序排序。",
    start_time: "2025-07-01 08:00:00",
    end_time: "2025-07-25 23:59:59",
    requirements: "历史批次已关闭。",
    status: "closed",
    created_by: 2,
    creator_name: "管理员",
    options: { allowStudentEdit: false, allowReturnEdit: false, requireReviewerComment: false },
    review_assignments: [],
    created_at: "2025-07-01 09:00:00",
    updated_at: "2025-07-25 23:59:59",
  },
];

const evidenceFiles = [
  { id: 501, name: "思想政治学习记录.pdf", type: "PDF", url: "/uploads/demo_politics.pdf" },
  { id: 502, name: "专业课程成绩单.pdf", type: "PDF", url: "/uploads/demo_scores.pdf" },
  { id: 503, name: "互联网+创新创业竞赛获奖证书.pdf", type: "PDF", url: "/uploads/demo_award.pdf" },
  { id: 504, name: "志愿服务时长证明.jpg", type: "图片", url: "/uploads/demo_service.jpg" },
  { id: 505, name: "学习委员任职证明.docx", type: "Word", url: "/uploads/demo_position.docx" },
];

const forms = [];

const logs = [
  { id: 1901, operator_name: "管理员", action: "发布批次", target: batches[0].title, detail: "指定学院、年级和跨班互评关系", created_at: "2026-07-09 09:00:00" },
];

function cloneUser(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return {
    ...clone(rest),
    role_name: ROLE_LABEL[user.role] || user.role,
    member_label: user.role === "student" && user.is_assessment_member ? "综测成员" : "",
  };
}

function findUser(username) {
  return users.find(user => user.username === username);
}

function getUser(id) {
  return users.find(user => user.id === Number(id));
}

function getBatch(id) {
  return batches.find(batch => batch.id === Number(id));
}

function visibleBatch(batch) {
  return batch && batch.status !== "deleted";
}

function compareBatchTime(a, b) {
  return String(b.start_time || b.created_at).localeCompare(String(a.start_time || a.created_at));
}

function normalizeClassIds(ids) {
  return Array.isArray(ids) ? ids.map(Number).filter(Boolean) : [];
}

function isStudent(user) {
  return user?.role === "student";
}

function isInScope(user, student) {
  if (!user || !student) return false;
  if (user.role === "admin" || user.role === "student_affairs") return true;
  if (user.role === "counselor") {
    const scope = user.scope || {};
    if (scope.college && student.college !== scope.college) return false;
    if (scope.grade && student.grade !== scope.grade) return false;
    const classIds = normalizeClassIds(scope.class_ids);
    if (classIds.length && !classIds.includes(Number(student.class_id))) return false;
    return true;
  }
  if (student.id === user.id) return true;
  return false;
}

function studentsOnly() {
  return users.filter(user => user.role === "student");
}

function studentMatchesBatch(student, batch) {
  return student.role === "student" && student.college === batch.college && student.grade === batch.grade;
}

function calculateLevel(score) {
  const sorted = [...settings.gradeRules].sort((a, b) => b.min - a.min);
  const found = sorted.find(rule => Number(score) >= Number(rule.min));
  return found ? found.grade : "不合格";
}

function baseItems(seed = 0) {
  return [
    { id: nextId++, section: "F1", subKey: "A1", title: "思想政治学习表现良好", reason: "智能填表模块识别到思想政治学习记录。", score: 4, evidence_ids: [501], editable: true },
    { id: nextId++, section: "F1", subKey: "A3", title: "学习态度认真，课程出勤良好", reason: "结合课程记录和学生基础数据生成。", score: 4, evidence_ids: [502], editable: true },
    { id: nextId++, section: "F2", subKey: "COURSE", title: "课程学习成绩", reason: "智能填表模块读取成绩单并计算课程学习成绩评分。", score: 65 + seed, evidence_ids: [502], editable: true },
    { id: nextId++, section: "F3", subKey: "B2", title: "创新创业竞赛获奖", reason: "从获奖证书中识别竞赛名称与获奖等级。", score: 5, evidence_ids: [503], editable: true },
    { id: nextId++, section: "F3", subKey: "B6", title: "志愿服务累计时长", reason: "从志愿服务证明中识别服务时长。", score: 3, evidence_ids: [504], editable: true },
  ];
}

function recalcScores(form) {
  const f1 = form.items.filter(i => i.section === "F1").reduce((sum, item) => sum + Number(item.score || 0), 0);
  const f2 = form.items.filter(i => i.section === "F2").reduce((sum, item) => sum + Number(item.score || 0), 0);
  const f3 = form.items.filter(i => i.section === "F3").reduce((sum, item) => sum + Number(item.score || 0), 0);
  form.scores.f1_basic_quality = f1;
  form.scores.f2_course_learning = f2;
  form.scores.f3_innovation_practice = f3;
  form.scores.total = f1 + f2 + f3;
  if (!form.manual_level) form.level = calculateLevel(form.scores.total);
  return form;
}

function canStudentEditForm(form) {
  if (!form) return false;
  const batch = getBatch(form.batch_id);
  if (!batch || batch.status !== "published") return false;
  const allowStudentEdit = batch.options?.allowStudentEdit ?? settings.allowStudentEdit;
  const allowReturnEdit = batch.options?.allowReturnEdit ?? settings.allowReturnEdit;
  if (form.status === "smart_ready") return !!allowStudentEdit;
  if (form.status && form.status.startsWith("returned")) return !!allowReturnEdit;
  return false;
}

function getStudentReadonlyReason(form) {
  const batch = getBatch(form.batch_id);
  if (!batch) return "批次不存在";
  if (batch.status !== "published") return "该批次未发布或已关闭";
  if (canStudentEditForm(form)) return "";
  if (form.status === "pending_class_committee") return "已提交，正在等待综测成员评价";
  if (form.status === "pending_counselor") return "综测成员已通过，正在等待辅导员评价";
  if (form.status === "pending_student_affairs") return "辅导员已通过，正在等待学工办评价";
  if (form.status === "approved") return "已认定通过，当前不可修改";
  if (form.status === "rejected") return "当前结果已不予认定，当前不可修改";
  return "当前状态不可修改";
}

function groupedItems(form) {
  return formStructure.map(section => ({
    ...section,
    score: form.scores[section.scoreKey],
    children: section.children.map(child => ({
      ...child,
      items: form.items
        .filter(item => item.section === section.key && item.subKey === child.key)
        .map(item => ({
          ...item,
          evidence_files: evidenceFiles.filter(file => item.evidence_ids.includes(file.id)),
        })),
    })),
  }));
}

function formView(form) {
  recalcScores(form);
  const batch = getBatch(form.batch_id);
  return {
    ...clone(form),
    batch_title: batch?.title || form.batch_title,
    batch_status: batch?.status || "",
    status_label: STATUS_LABEL[form.status] || form.status,
    level: form.manual_level || form.level || calculateLevel(form.scores.total),
    auto_level: calculateLevel(form.scores.total),
    can_student_edit: canStudentEditForm(form),
    can_student_submit: canStudentEditForm(form),
    readonly_reason: getStudentReadonlyReason(form),
    grouped_items: groupedItems(form),
  };
}

function addLog(operator, action, target, detail) {
  logs.unshift({
    id: nextId++,
    operator_name: operator?.real_name || ROLE_LABEL[operator?.role] || "系统",
    action,
    target,
    detail,
    created_at: now(),
  });
}

function listBatches(user) {
  const list = batches.filter(visibleBatch);
  if (user?.role === "student") return list.filter(batch => studentMatchesBatch(user, batch)).sort(compareBatchTime).map(enrichBatch);
  if (user?.role === "counselor") return list.filter(batch => batch.college === user.scope?.college && batch.grade === user.scope?.grade).sort(compareBatchTime).map(enrichBatch);
  return list.sort(compareBatchTime).map(enrichBatch);
}

function listStudentBatches(user) {
  if (!isStudent(user)) return [];
  return batches
    .filter(visibleBatch)
    .filter(batch => studentMatchesBatch(user, batch))
    .sort(compareBatchTime)
    .map(enrichBatch);
}

function uniqueSchoolYear(data) {
  return data.school_year || String(data.title || "").match(/\d{4}-\d{4}/)?.[0] || "";
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

function validateSchoolYearRange(schoolYear) {
  const start = parseSchoolYearStart(schoolYear);
  const current = currentAcademicYearStart();
  if (start < current) throw new Error("不能选择早于当前学年的批次");
  if (start > current + 100) throw new Error("学年最多只能选择至当前学年后 100 年");
}

function enrichBatch(batch) {
  const targetStudents = studentsOnly().filter(student => studentMatchesBatch(student, batch));
  const batchForms = forms.filter(form => form.batch_id === batch.id);
  return {
    ...clone(batch),
    target_student_count: targetStudents.length,
    submitted_count: batchForms.filter(form => form.status !== "smart_ready").length,
    approved_count: batchForms.filter(form => form.status === "approved").length,
    pending_count: batchForms.filter(form => ["pending_class_committee", "pending_counselor", "pending_student_affairs"].includes(form.status)).length,
  };
}

function createBatch(data, operator) {
  if (!data.college) throw new Error("创建批次必须指定学院");
  if (!data.grade) throw new Error("创建批次必须指定年级");
  const schoolYear = uniqueSchoolYear(data);
  if (!schoolYear) throw new Error("创建批次必须指定学年，例如 2025-2026");
  validateSchoolYearRange(schoolYear);
  const duplicated = batches.find(batch => visibleBatch(batch) && batch.college === data.college && batch.grade === data.grade && batch.school_year === schoolYear);
  if (duplicated) throw new Error("该学院、该年级在该学年已经存在批次，每年只能填写一次");
  const batch = {
    id: nextId++,
    school_year: schoolYear,
    title: data.title || `${schoolYear}学年综测`,
    college: data.college,
    grade: data.grade,
    description: data.description || "",
    start_time: data.start_time || now(),
    end_time: data.end_time || settings.submitDeadline,
    requirements: data.requirements || "",
    status: data.status || "published",
    created_by: operator.id,
    creator_name: operator.real_name || "管理员",
    options: {
      allowStudentEdit: data.allowStudentEdit ?? settings.allowStudentEdit,
      allowReturnEdit: data.allowReturnEdit ?? settings.allowReturnEdit,
      requireReviewerComment: data.requireReviewerComment ?? settings.requireReviewerComment,
    },
    review_assignments: normalizeAssignments(data.review_assignments || []),
    created_at: now(),
    updated_at: now(),
  };
  batches.unshift(batch);
  addLog(operator, "发布批次", batch.title, `目标：${batch.college}${batch.grade}`);
  return enrichBatch(batch);
}

function normalizeAssignments(assignments) {
  return assignments.map(input => {
    const targetClass = classes.find(c => c.id === Number(input.target_class_id));
    const reviewerClass = classes.find(c => c.id === Number(input.reviewer_class_id));
    if (!targetClass || !reviewerClass) throw new Error("互评配置中的班级不存在");
    if (targetClass.id === reviewerClass.id) throw new Error("跨班互评不支持本班评本班");
    return {
      id: Number(input.id) || nextId++,
      target_class_id: targetClass.id,
      target_class_name: targetClass.name,
      reviewer_class_id: reviewerClass.id,
      reviewer_class_name: reviewerClass.name,
      reviewer_ids: normalizeClassIds(input.reviewer_ids),
    };
  });
}

function updateBatch(id, data, operator) {
  const batch = getBatch(id);
  if (!visibleBatch(batch)) throw new Error("批次不存在");
  if (data.school_year !== undefined) validateSchoolYearRange(data.school_year);
  ["title", "school_year", "college", "grade", "description", "start_time", "end_time", "requirements"].forEach(key => {
    if (data[key] !== undefined) batch[key] = data[key];
  });
  ["allowStudentEdit", "allowReturnEdit", "requireReviewerComment"].forEach(key => {
    if (data[key] !== undefined) batch.options[key] = !!data[key];
  });
  if (data.status !== undefined) batch.status = data.status;
  if (Array.isArray(data.review_assignments)) batch.review_assignments = normalizeAssignments(data.review_assignments);
  batch.updated_at = now();
  addLog(operator, "修改批次", batch.title, "更新批次信息或跨班互评配置");
  return enrichBatch(batch);
}

function updateBatchStatus(id, status, operator) {
  return updateBatch(id, { status }, operator);
}

function deleteBatch(id, operator) {
  const batch = getBatch(id);
  if (!visibleBatch(batch)) throw new Error("批次不存在");
  batch.status = "deleted";
  batch.updated_at = now();
  addLog(operator, "删除批次", batch.title, "批次已从管理列表删除");
  return enrichBatch(batch);
}

function getSettings() {
  return clone({ ...settings, formStructure });
}

function updateSettings(data, operator) {
  if (Array.isArray(data.gradeRules)) {
    settings.gradeRules = data.gradeRules.filter(rule => rule.grade !== undefined && rule.min !== undefined).map(rule => ({ grade: String(rule.grade), min: Number(rule.min) }));
  }
  ["submitDeadline", "publishNotice"].forEach(key => { if (data[key] !== undefined) settings[key] = data[key]; });
  ["allowStudentEdit", "allowReturnEdit", "requireReviewerComment"].forEach(key => { if (data[key] !== undefined) settings[key] = !!data[key]; });
  addLog(operator, "更新系统设置", "综测规则", "管理员更新截止时间、等级规则或流程选项");
  return getSettings();
}

function ensureForm(userId, batchId) {
  const student = getUser(userId);
  if (!student || student.role !== "student") throw new Error("只有学生可以查看自己的综测信息");
  const batch = getBatch(batchId);
  if (!visibleBatch(batch) || !studentMatchesBatch(student, batch)) throw new Error("该批次不属于当前学生所在学院或年级");
  let form = forms.find(f => f.student_id === student.id && f.batch_id === batch.id);
  if (!form) {
    const seed = student.id % 3;
    form = {
      id: nextId++,
      batch_id: batch.id,
      student_id: student.id,
      student_name: student.real_name,
      student_no: student.student_no,
      college: student.college,
      major: student.major,
      grade: student.grade,
      enrollment_grade: student.enrollment_grade || student.grade,
      class_id: student.class_id,
      class_name: student.class_name,
      from_smart_fill: true,
      status: "smart_ready",
      level: "",
      manual_level: "",
      scores: { f1_basic_quality: 0, f2_course_learning: 0, f3_innovation_practice: 0, total: 0 },
      personal_summary: "该内容由智能填表模块根据学生上传材料和基础信息生成，学生端选择批次后确认与提交。",
      items: baseItems(seed),
      review_tasks: [],
      review_records: [],
      created_at: now(),
      updated_at: now(),
    };
    recalcScores(form);
    forms.push(form);
  }
  return form;
}

function getSmartResult(userId, batchId) {
  if (!batchId) throw new Error("请先选择综测批次");
  return formView(ensureForm(userId, batchId));
}

function getForm(id) {
  const form = forms.find(f => f.id === Number(id));
  if (!form) throw new Error("评价表不存在");
  return formView(form);
}

function uploadEvidence(userId, file, batchId) {
  const form = ensureForm(userId, batchId);
  if (!canStudentEditForm(form)) throw new Error(getStudentReadonlyReason(form));
  const saved = { id: nextId++, name: file?.originalname || "新增支撑材料", type: file?.mimetype || "文件", url: file?.filename ? `/uploads/${file.filename}` : "" };
  evidenceFiles.push(saved);
  form.items.push({ id: nextId++, section: "F3", subKey: "B6", title: `新增支撑材料：${saved.name}`, reason: "由学生补充上传，后续可在信息管理页修改分类。", score: 0, evidence_ids: [saved.id], editable: true });
  form.updated_at = now();
  recalcScores(form);
  addLog(getUser(userId), "上传支撑材料", saved.name, "材料进入当前批次综测表");
  return formView(form);
}

function updateFormItems(userId, payload) {
  const form = ensureForm(userId, payload.batch_id);
  if (!canStudentEditForm(form)) throw new Error(getStudentReadonlyReason(form));
  if (payload.personal_summary !== undefined) form.personal_summary = String(payload.personal_summary);
  if (Array.isArray(payload.items)) {
    const oldItems = clone(form.items);
    form.items = payload.items.map(input => {
      const oldItem = oldItems.find(i => String(i.id) === String(input.id));
      const section = String(input.section || oldItem?.section || "F3");
      const validSection = formStructure.find(s => s.key === section) || formStructure[2];
      const subKey = String(input.subKey || oldItem?.subKey || validSection.children[0]?.key || "");
      const validChild = validSection.children.find(child => child.key === subKey) || validSection.children[0];
      return {
        id: oldItem?.id || nextId++,
        section: validSection.key,
        subKey: validChild?.key || "",
        title: String(input.title ?? oldItem?.title ?? "新增加分项目"),
        reason: String(input.reason ?? oldItem?.reason ?? ""),
        score: Number(input.score) || 0,
        evidence_ids: Array.isArray(input.evidence_ids) ? input.evidence_ids.map(Number).filter(Boolean) : (oldItem?.evidence_ids || []),
        editable: input.editable !== undefined ? !!input.editable : true,
      };
    });
  }
  form.manual_level = "";
  recalcScores(form);
  form.updated_at = now();
  addLog(getUser(userId), "保存综测信息", form.student_name, "学生在信息管理页保存当前批次综测表");
  return formView(form);
}

function memberCandidatesForAssignment(assignment) {
  let list = studentsOnly().filter(student => student.is_assessment_member && Number(student.class_id) === Number(assignment.reviewer_class_id));
  const selected = normalizeClassIds(assignment.reviewer_ids);
  if (selected.length) list = list.filter(student => selected.includes(student.id));
  return list;
}

function taskLoadCount(batchId, reviewerId) {
  return forms.reduce((sum, form) => {
    if (form.batch_id !== batchId) return sum;
    return sum + (form.review_tasks || []).filter(task => task.reviewer_id === reviewerId && task.status !== "cancelled").length;
  }, 0);
}

function assignReviewTasks(form) {
  const batch = getBatch(form.batch_id);
  const assignment = (batch.review_assignments || []).find(item => Number(item.target_class_id) === Number(form.class_id));
  if (!assignment) throw new Error("该班级尚未配置跨班互评关系，请联系辅导员或管理员");
  if (Number(assignment.target_class_id) === Number(assignment.reviewer_class_id)) throw new Error("跨班互评不支持本班评本班");
  const members = memberCandidatesForAssignment(assignment);
  if (!members.length) throw new Error("评测班级暂无可用综测成员，请辅导员先赋予综测成员身份");
  const selected = [...members].sort((a, b) => taskLoadCount(form.batch_id, a.id) - taskLoadCount(form.batch_id, b.id) || a.id - b.id)[0];
  form.review_tasks = [{
    id: nextId++,
    batch_id: form.batch_id,
    form_id: form.id,
    reviewer_id: selected.id,
    reviewer_name: selected.real_name,
    reviewer_no: selected.student_no,
    reviewer_class_id: selected.class_id,
    reviewer_class_name: selected.class_name,
    target_class_name: form.class_name,
    status: "pending",
    action: "",
    comment: "",
    assigned_at: now(),
    completed_at: "",
  }];
  return selected;
}

function submitSmartResult(userId, data = {}) {
  const form = ensureForm(userId, data.batch_id);
  if (!canStudentEditForm(form)) throw new Error(getStudentReadonlyReason(form));
  if (!form.items.length) throw new Error("请至少保留一项综测内容后再提交");
  const reviewer = assignReviewTasks(form);
  form.status = "pending_class_committee";
  form.updated_at = now();
  recalcScores(form);
  addLog(getUser(userId), "提交综测表", getBatch(form.batch_id).title, `系统已按工作量均分给 ${reviewer.real_name}`);
  return formView(form);
}

function canReadForm(user, form) {
  const student = getUser(form.student_id);
  if (user.role === "student") {
    if (Number(form.student_id) === Number(user.id)) return true;
    return !!(user.is_assessment_member && (form.review_tasks || []).some(task => Number(task.reviewer_id) === Number(user.id)));
  }
  if (user.role === "counselor") return isInScope(user, student);
  return ["admin", "student_affairs"].includes(user.role);
}

function listFormsByUser(user) {
  if (user.role === "student") {
    return forms.filter(form => canReadForm(user, form)).map(formView);
  }
  return forms.filter(form => canReadForm(user, form)).map(formView);
}

function pendingReviews(user) {
  if (user.role === "student") {
    if (!user.is_assessment_member) return [];
    return forms
      .filter(form => form.status === "pending_class_committee")
      .filter(form => (form.review_tasks || []).some(task => Number(task.reviewer_id) === Number(user.id) && task.status === "pending"))
      .map(formView);
  }
  if (user.role === "counselor") {
    return forms.filter(form => form.status === "pending_counselor").filter(form => canReadForm(user, form)).map(formView);
  }
  if (user.role === "student_affairs") {
    return forms.filter(form => form.status === "pending_student_affairs").map(formView);
  }
  return [];
}

function setFormLevel(formId, level, operator) {
  const form = forms.find(f => f.id === Number(formId));
  if (!form) throw new Error("评价表不存在");
  if (!canReadForm(operator, form)) throw new Error("无权调整该综测表等级");
  form.manual_level = level || "";
  form.level = form.manual_level || calculateLevel(form.scores.total);
  form.updated_at = now();
  addLog(operator, "调整测评等级", form.student_name, `等级设置为 ${form.level}`);
  return formView(form);
}

function reviewForm(id, reviewer, action, comment = "", level = "") {
  const form = forms.find(f => f.id === Number(id));
  if (!form) throw new Error("评价表不存在");
  if (!canReadForm(reviewer, form)) throw new Error("无权评价该综测表");
  if (settings.requireReviewerComment && !comment) throw new Error("请填写评价意见");

  let actorLabel = ROLE_LABEL[reviewer.role] || "评价人员";
  let nextStatus = "";

  if (reviewer.role === "student") {
    if (!reviewer.is_assessment_member) throw new Error("当前学生未被辅导员赋予综测成员身份");
    if (form.status !== "pending_class_committee") throw new Error(`当前状态为“${STATUS_LABEL[form.status]}”，不属于综测成员待评价范围`);
    const task = (form.review_tasks || []).find(item => Number(item.reviewer_id) === Number(reviewer.id) && item.status === "pending");
    if (!task) throw new Error("你只能评价分配给自己的待评表单");
    task.status = action === "approve" ? "approved" : action === "return" ? "returned" : "rejected";
    task.action = action;
    task.comment = comment;
    task.completed_at = now();
    actorLabel = "综测成员";
    nextStatus = action === "approve" ? "pending_counselor" : action === "return" ? "returned_by_class_committee" : "rejected";
  } else if (reviewer.role === "counselor") {
    if (form.status !== "pending_counselor") throw new Error(`当前状态为“${STATUS_LABEL[form.status]}”，不属于辅导员待评价范围`);
    nextStatus = action === "approve" ? "pending_student_affairs" : action === "return" ? "returned_by_counselor" : "rejected";
  } else if (reviewer.role === "student_affairs") {
    if (form.status !== "pending_student_affairs") throw new Error(`当前状态为“${STATUS_LABEL[form.status]}”，不属于学工办待评价范围`);
    nextStatus = action === "approve" ? "approved" : action === "return" ? "returned_by_student_affairs" : "rejected";
  } else {
    throw new Error("当前角色不可进行评价");
  }

  if (!nextStatus) throw new Error("无效评价操作");
  if ((reviewer.role === "student" || reviewer.role === "counselor") && action === "approve") {
    form.manual_level = level || form.manual_level || "";
    form.level = form.manual_level || calculateLevel(form.scores.total);
  }

  const record = {
    id: nextId++,
    reviewer_role: reviewer.role === "student" ? "assessment_member" : reviewer.role,
    reviewer_name: reviewer.role === "student" ? `${reviewer.real_name}（综测成员）` : ROLE_LABEL[reviewer.role],
    action,
    action_label: action === "approve" ? "通过" : action === "return" ? "退回修改" : "不予认定",
    level: form.manual_level || form.level,
    comment,
    created_at: now(),
  };
  form.review_records.push(record);
  form.status = nextStatus;
  form.updated_at = now();
  addLog(reviewer, `${actorLabel}评价`, form.student_name, `${record.action_label}：${comment || "无意见"}`);
  return formView(form);
}

function listStudents(user) {
  return studentsOnly().filter(student => isInScope(user, student)).map(student => {
    const studentForms = forms.filter(form => form.student_id === student.id).map(formView);
    return {
      ...cloneUser(student),
      forms: studentForms,
      latest_status_label: studentForms[0]?.status_label || "暂无综测表",
      latest_total_score: studentForms[0]?.scores?.total || "-",
    };
  });
}

function updateCounselorScope(userId, scope) {
  const counselor = getUser(userId);
  if (!counselor || counselor.role !== "counselor") throw new Error("仅辅导员可设置管辖范围");
  if (!scope.college) throw new Error("学院为必选项");
  if (!scope.grade) throw new Error("年级为必选项");
  counselor.scope = {
    college: scope.college,
    grade: scope.grade,
    class_ids: normalizeClassIds(scope.class_ids),
  };
  addLog(counselor, "设置管辖范围", counselor.real_name, `${scope.college}${scope.grade}`);
  return cloneUser(counselor);
}

function setAssessmentMember(operator, studentId, enabled) {
  const student = getUser(studentId);
  if (!student || student.role !== "student") throw new Error("学生不存在");
  if (operator.role === "counselor" && !isInScope(operator, student)) throw new Error("只能管理管辖范围内的学生");
  student.is_assessment_member = !!enabled;
  addLog(operator, enabled ? "赋予综测成员" : "撤销综测成员", student.real_name, enabled ? "该学生可接收分配给自己的待评表单" : "该学生不再接收新的待评任务");
  return cloneUser(student);
}

function getScopeOptions() {
  const colleges = [...new Set([
    ...classes.map(c => c.college),
    ...users.map(user => user.college),
  ].filter(Boolean))];
  const grades = [...new Set([
    ...classes.map(c => c.grade),
    ...users.map(user => user.grade),
    ...users.map(user => user.enrollment_grade),
  ].filter(Boolean))].sort().reverse();
  return clone({
    colleges,
    grades,
    classes,
    members: studentsOnly().filter(s => s.is_assessment_member).map(cloneUser),
    students: studentsOnly().map(cloneUser),
  });
}

function normalizeGradeText(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const match = raw.match(/^(\d{4})/);
  return match ? `${match[1]}级` : raw;
}

function findOrCreateClass(college, grade, className) {
  const name = String(className || "").trim();
  const normalizedCollege = String(college || "").trim();
  const normalizedGrade = normalizeGradeText(grade);
  if (!name) return null;
  let cls = classes.find(item => item.name === name && item.college === normalizedCollege && item.grade === normalizedGrade);
  if (!cls) {
    cls = { id: nextId++, name, college: normalizedCollege, grade: normalizedGrade };
    classes.push(cls);
  }
  return cls;
}

function createTemporaryUser(data, operator) {
  if (operator?.role !== "admin") throw new Error("仅管理员可创建临时账号");
  const role = String(data.role || "").trim();
  if (!ROLE_LABEL[role]) throw new Error("请选择有效角色");

  const username = String(data.username || "").trim();
  if (!username) throw new Error("请输入登录账号");
  if (findUser(username)) throw new Error("登录账号已存在");

  const realName = String(data.real_name || "").trim() || username;
  const password = String(data.password || "").trim() || "123456";
  const college = String(data.college || "").trim();
  const grade = normalizeGradeText(data.grade);
  const className = String(data.class_name || "").trim();
  const studentNo = String(data.student_no || "").trim();
  const major = String(data.major || "").trim();

  if (["student", "counselor"].includes(role)) {
    if (!college) throw new Error("学生和辅导员必须填写学院");
    if (!grade) throw new Error("学生和辅导员必须填写年级");
  }
  if (className && (!college || !grade)) throw new Error("填写班级时请同时填写学院和年级");
  if (studentNo && users.some(user => user.student_no && user.student_no === studentNo)) throw new Error("学号已存在");
  if (role === "student") {
    if (!studentNo) throw new Error("学生必须填写学号");
    if (!className) throw new Error("学生必须填写班级");
  }

  const cls = findOrCreateClass(college, grade, className);
  const base = {
    id: nextId++,
    username,
    password,
    role,
    real_name: realName,
  };

  if (role === "student") {
    Object.assign(base, {
      student_no: studentNo,
      college,
      class_id: cls.id,
      class_name: cls.name,
      grade,
      enrollment_grade: grade,
      major: major || college,
      is_assessment_member: !!data.is_assessment_member,
    });
  } else if (role === "counselor") {
    Object.assign(base, {
      college,
      grade,
      class_id: cls?.id || null,
      class_name: cls?.name || "",
      scope: { college, grade, class_ids: cls ? [cls.id] : [] },
    });
  } else {
    Object.assign(base, {
      student_no: studentNo,
      college,
      grade,
      class_id: cls?.id || null,
      class_name: cls?.name || "",
      major,
    });
  }

  users.push(base);
  addLog(operator, "创建临时账号", `${realName}（${ROLE_LABEL[role]}）`, `账号：${username}，学院：${college || "-"}，班级：${className || "-"}`);
  return cloneUser(base);
}

function getStatistics(query = {}, user = null) {
  let filtered = forms;
  if (query.batch_id) filtered = filtered.filter(f => f.batch_id === Number(query.batch_id));
  if (user) filtered = filtered.filter(form => canReadForm(user, form));
  const rows = filtered.map(f => {
    recalcScores(f);
    const batch = getBatch(f.batch_id);
    return {
      id: f.id,
      batch_id: f.batch_id,
      batch_title: batch?.title || "",
      college: f.college,
      grade: f.grade,
      student_name: f.student_name,
      student_no: f.student_no,
      class_name: f.class_name,
      reviewer_names: (f.review_tasks || []).map(task => task.reviewer_name).join("、") || "未分配",
      total_score: f.scores.total,
      level: f.manual_level || f.level || calculateLevel(f.scores.total),
      status: f.status,
      status_label: STATUS_LABEL[f.status],
    };
  });
  const tasks = filtered.flatMap(form => form.review_tasks || []);
  return {
    total_students: studentsOnly().length,
    submitted: filtered.filter(f => f.status !== "smart_ready").length,
    approved: filtered.filter(f => f.status === "approved").length,
    rejected: filtered.filter(f => f.status === "rejected").length,
    returned: filtered.filter(f => f.status.startsWith("returned")).length,
    pending_class_committee: filtered.filter(f => f.status === "pending_class_committee").length,
    pending_counselor: filtered.filter(f => f.status === "pending_counselor").length,
    pending_student_affairs: filtered.filter(f => f.status === "pending_student_affairs").length,
    task_total: tasks.length,
    task_pending: tasks.filter(t => t.status === "pending").length,
    task_done: tasks.filter(t => ["approved", "returned", "rejected"].includes(t.status)).length,
    rows,
  };
}

function exportCsv(query = {}, user = null) {
  const stats = getStatistics(query, user);
  const rows = [
    ["批次", "学院", "年级", "学生姓名", "学号", "班级", "评测人", "综合分", "等级", "当前状态"],
    ...stats.rows.map(f => [f.batch_title, f.college, f.grade, f.student_name, f.student_no, f.class_name, f.reviewer_names, f.total_score, f.level, f.status_label]),
  ];
  return "\ufeff" + rows.map(row => row.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
}

module.exports = {
  ROLE_LABEL,
  STATUS_LABEL,
  formStructure,
  cloneUser,
  findUser,
  getUser,
  listBatches,
  listStudentBatches,
  createBatch,
  updateBatch,
  updateBatchStatus,
  deleteBatch,
  getSettings,
  updateSettings,
  getSmartResult,
  getForm,
  uploadEvidence,
  updateFormItems,
  setFormLevel,
  submitSmartResult,
  canReadForm,
  listFormsByUser,
  pendingReviews,
  reviewForm,
  listStudents,
  updateCounselorScope,
  setAssessmentMember,
  getScopeOptions,
  createTemporaryUser,
  getStatistics,
  exportCsv,
  logs: () => clone(logs),
};
