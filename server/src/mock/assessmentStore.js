const ROLE_LABEL = {
  student: "学生",
  admin: "管理员",
  class_committee: "班级测评小组",
  counselor: "辅导员",
  student_affairs: "学生工作处",
};

const STATUS_LABEL = {
  smart_ready: "智能填表待提交",
  pending_class_committee: "待班级测评小组评价",
  returned_by_class_committee: "班级测评小组退回",
  pending_counselor: "待辅导员评价",
  returned_by_counselor: "辅导员退回",
  pending_student_affairs: "待学生工作处评价",
  returned_by_student_affairs: "学生工作处退回",
  approved: "学生工作处认定通过",
  rejected: "不予认定",
};

let nextId = 2000;
const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");
const clone = (data) => JSON.parse(JSON.stringify(data));

const users = [
  { id: 1, username: "student", password: "123456", role: "student", real_name: "张同学", student_no: "20240001", class_id: 1, class_name: "计科2401班", college: "信息科学与工程学院", major: "计算机科学与技术", grade: "2024级" },
  { id: 2, username: "admin", password: "123456", role: "admin", real_name: "管理员" },
  { id: 3, username: "classgroup", password: "123456", role: "class_committee", real_name: "班级测评小组", class_id: 1, class_name: "计科2401班" },
  { id: 4, username: "counselor", password: "123456", role: "counselor", real_name: "辅导员", class_id: 1, class_name: "计科2401班" },
  { id: 5, username: "affairs", password: "123456", role: "student_affairs", real_name: "学生工作处" },

  // 兼容上一版账号
  { id: 6, username: "reviewer1", password: "123456", role: "class_committee", real_name: "班级测评小组", class_id: 1, class_name: "计科2401班" },
  { id: 7, username: "reviewer2", password: "123456", role: "counselor", real_name: "辅导员", class_id: 1, class_name: "计科2401班" },
  { id: 8, username: "reviewer3", password: "123456", role: "student_affairs", real_name: "学生工作处" },
];

const formStructure = [
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
    children: [
      { key: "COURSE", title: "课程成绩" },
    ],
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
  publishNotice: "请在截止时间前确认智能填表结果，并提交至班级测评小组。",
};

const batches = [
  {
    id: 101,
    title: "2025-2026学年本科学生综合素质测评",
    description: "学生上传支撑材料后，由智能填表模块生成综测评价表结果。",
    start_time: "2026-07-01 08:00:00",
    end_time: settings.submitDeadline,
    requirements: "评价表结果由智能填表模块生成，三类评价主体依次评价。",
    status: "published",
    created_by: 2,
    creator_name: "管理员",
    options: {
      allowStudentEdit: true,
      allowReturnEdit: true,
      requireReviewerComment: false,
    },
    created_at: "2026-07-09 09:00:00",
  },
];

const evidenceFiles = [
  { id: 501, name: "思想政治学习记录.pdf", type: "PDF", url: "/uploads/demo_politics.pdf" },
  { id: 502, name: "专业课程成绩单.pdf", type: "PDF", url: "/uploads/demo_scores.pdf" },
  { id: 503, name: "互联网+创新创业竞赛获奖证书.pdf", type: "PDF", url: "/uploads/demo_award.pdf" },
  { id: 504, name: "志愿服务时长证明.jpg", type: "图片", url: "/uploads/demo_service.jpg" },
  { id: 505, name: "学习委员任职证明.docx", type: "Word", url: "/uploads/demo_position.docx" },
];

const forms = [
  {
    id: 201,
    batch_id: 101,
    batch_title: batches[0].title,
    student_id: 1,
    student_name: "张同学",
    student_no: "20240001",
    college: "信息科学与工程学院",
    major: "计算机科学与技术",
    grade: "2024级",
    class_id: 1,
    class_name: "计科2401班",
    from_smart_fill: true,
    status: "smart_ready",
    level: "优",
    manual_level: "",
    scores: {
      f1_basic_quality: 18,
      f2_course_learning: 66,
      f3_innovation_practice: 11,
      total: 95,
    },
    personal_summary: "该内容由智能填表模块根据学生上传材料和基础信息生成，学生端仅确认与提交。",
    items: [
      {
        id: 301,
        section: "F1",
        subKey: "A1",
        title: "思想政治学习表现良好",
        reason: "智能填表模块从思想政治学习记录中识别相关信息，匹配至思想政治表现A1。",
        score: 4,
        evidence_ids: [501],
        editable: true,
      },
      {
        id: 302,
        section: "F1",
        subKey: "A3",
        title: "学习态度认真，课程出勤良好",
        reason: "智能填表模块结合课程记录和学生基础数据，匹配至学习态度作风A3。",
        score: 4,
        evidence_ids: [502],
        editable: true,
      },
      {
        id: 303,
        section: "F2",
        subKey: "COURSE",
        title: "课程学习成绩",
        reason: "智能填表模块读取成绩单并计算课程学习成绩评分。",
        score: 66,
        evidence_ids: [502],
        editable: true,
      },
      {
        id: 304,
        section: "F3",
        subKey: "B2",
        title: "互联网+创新创业竞赛校级二等奖",
        reason: "智能填表模块从获奖证书中识别竞赛名称与获奖等级，匹配至学科竞赛类B2。",
        score: 5,
        evidence_ids: [503],
        editable: true,
      },
      {
        id: 305,
        section: "F3",
        subKey: "B5",
        title: "担任学习委员并完成班级服务工作",
        reason: "智能填表模块从任职证明中识别学生干部经历，匹配至社会工作类B5。",
        score: 3,
        evidence_ids: [505],
        editable: true,
      },
      {
        id: 306,
        section: "F3",
        subKey: "B6",
        title: "志愿服务累计 36 小时",
        reason: "智能填表模块从志愿服务证明中识别服务时长，匹配至社会实践类B6。",
        score: 3,
        evidence_ids: [504],
        editable: true,
      },
    ],
    review_records: [],
    created_at: "2026-07-09 09:15:00",
    updated_at: "2026-07-09 09:15:00",
  },
];

const logs = [
  { id: 901, operator_name: "管理员", action: "发布批次", target: batches[0].title, detail: "管理员发布综测批次", created_at: "2026-07-09 09:00:00" },
];

function cloneUser(user) {
  if (!user) return null;
  const { password, ...rest } = user;
  return { ...rest, role_name: ROLE_LABEL[user.role] || user.role };
}

function calculateLevel(score) {
  const sorted = [...settings.gradeRules].sort((a, b) => b.min - a.min);
  const found = sorted.find((rule) => Number(score) >= Number(rule.min));
  return found ? found.grade : "不合格";
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
  if (form.status === "smart_ready") return !!settings.allowStudentEdit;
  if (form.status && form.status.startsWith("returned")) return !!settings.allowReturnEdit;
  return false;
}

function getStudentReadonlyReason(form) {
  if (canStudentEditForm(form)) return "";
  if (form.status === "smart_ready" && !settings.allowStudentEdit) return "当前批次未开放学生修改";
  if (form.status && form.status.startsWith("returned") && !settings.allowReturnEdit) return "当前批次未开放退回后修改";
  if (form.status === "pending_class_committee") return "已提交给班级测评小组，待退回后才可继续修改";
  if (form.status === "pending_counselor") return "班级测评小组已通过，正在等待辅导员评价";
  if (form.status === "pending_student_affairs") return "辅导员已通过，正在等待学生工作处评价";
  if (form.status === "approved") return "学生工作处已认定通过，当前不可修改";
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
  return {
    ...clone(form),
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

function getUser(id) {
  return users.find(user => user.id === Number(id));
}

function findUser(username) {
  return users.find(user => user.username === username);
}

function listBatches() {
  return clone(batches);
}

function createBatch(data, operator) {
  const batch = {
    id: nextId++,
    title: data.title || "未命名综测批次",
    description: data.description || "",
    start_time: data.start_time || "",
    end_time: data.end_time || settings.submitDeadline,
    requirements: data.requirements || "",
    status: data.status || "draft",
    created_by: operator.id,
    creator_name: operator.real_name || "管理员",
    options: {
      allowStudentEdit: data.allowStudentEdit ?? settings.allowStudentEdit,
      allowReturnEdit: data.allowReturnEdit ?? settings.allowReturnEdit,
      requireReviewerComment: data.requireReviewerComment ?? settings.requireReviewerComment,
    },
    created_at: now(),
  };
  batches.unshift(batch);
  addLog(operator, "创建批次", batch.title, "管理员创建综测批次");
  return clone(batch);
}

function updateBatchStatus(id, status, operator) {
  const batch = batches.find(b => b.id === Number(id));
  if (!batch) throw new Error("批次不存在");
  batch.status = status;
  addLog(operator, "更新批次状态", batch.title, `批次状态更新为 ${status}`);
  return clone(batch);
}

function getSettings() {
  return clone({ ...settings, formStructure });
}

function updateSettings(data, operator) {
  if (Array.isArray(data.gradeRules)) {
    settings.gradeRules = data.gradeRules
      .filter(rule => rule.grade !== undefined && rule.min !== undefined)
      .map(rule => ({ grade: String(rule.grade), min: Number(rule.min) }));
  }
  ["submitDeadline", "publishNotice"].forEach(key => {
    if (data[key] !== undefined) settings[key] = data[key];
  });
  ["allowStudentEdit", "allowReturnEdit", "requireReviewerComment"].forEach(key => {
    if (data[key] !== undefined) settings[key] = !!data[key];
  });
  batches.forEach(batch => {
    batch.end_time = settings.submitDeadline;
    batch.options = {
      allowStudentEdit: settings.allowStudentEdit,
      allowReturnEdit: settings.allowReturnEdit,
      requireReviewerComment: settings.requireReviewerComment,
    };
  });
  forms.forEach(form => {
    if (!form.manual_level) form.level = calculateLevel(form.scores.total);
  });
  addLog(operator, "更新系统设置", "综测批次设置", "管理员更新截止时间、分级标准或流程选项");
  return getSettings();
}

function getSmartResult(userId) {
  const form = forms.find(f => f.student_id === Number(userId)) || forms[0];
  return formView(form);
}

function getForm(id) {
  const form = forms.find(f => f.id === Number(id));
  if (!form) throw new Error("评价表不存在");
  return formView(form);
}

function uploadEvidence(userId, file) {
  const form = forms.find(f => f.student_id === Number(userId));
  if (!form) throw new Error("未找到智能填表结果");
  const saved = {
    id: nextId++,
    name: file?.originalname || "新增支撑材料",
    type: file?.mimetype || "文件",
    url: file?.filename ? `/uploads/${file.filename}` : "",
  };
  evidenceFiles.push(saved);
  form.items.push({
    id: nextId++,
    section: "F3",
    subKey: "B6",
    title: `新增支撑材料：${saved.name}`,
    reason: "本系统只接收智能填表结果，具体识别算法不在本次实现范围内，可在信息管理页修改分类。",
    score: 0,
    evidence_ids: [saved.id],
    editable: true,
  });
  form.updated_at = now();
  recalcScores(form);
  addLog(getUser(userId), "上传支撑材料", saved.name, "材料进入智能填表结果流转");
  return formView(form);
}

function updateFormItems(userId, payload) {
  const form = forms.find(f => f.student_id === Number(userId));
  if (!form) throw new Error("未找到智能填表结果");
  if (!canStudentEditForm(form)) throw new Error(getStudentReadonlyReason(form));
  if (payload.personal_summary !== undefined) form.personal_summary = String(payload.personal_summary);
  if (Array.isArray(payload.items)) {
    const oldItems = clone(form.items);
    form.items = payload.items.map(input => {
      const oldItem = oldItems.find(i => i.id === Number(input.id));
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
        evidence_ids: Array.isArray(input.evidence_ids)
          ? input.evidence_ids.map(Number).filter(Boolean)
          : (oldItem?.evidence_ids || []),
        editable: input.editable !== undefined ? !!input.editable : true,
      };
    });
  }
  form.manual_level = "";
  recalcScores(form);
  form.updated_at = now();
  addLog(getUser(userId), "修改智能填表结果", form.student_name, "学生在信息管理页修改加分项目或支撑材料分类");
  return formView(form);
}

function setFormLevel(formId, level, operator) {
  const form = forms.find(f => f.id === Number(formId));
  if (!form) throw new Error("评价表不存在");
  form.manual_level = level || "";
  form.level = form.manual_level || calculateLevel(form.scores.total);
  form.updated_at = now();
  addLog(operator, "调整测评等级", form.student_name, `${ROLE_LABEL[operator.role] || "评价主体"}将等级设置为 ${form.level}`);
  return formView(form);
}

function submitSmartResult(userId) {
  const form = forms.find(f => f.student_id === Number(userId));
  if (!form) throw new Error("未找到智能填表结果");
  if (!canStudentEditForm(form)) throw new Error(getStudentReadonlyReason(form));
  if (!form.items.length) throw new Error("请至少保留一项综测内容后再提交");
  form.status = "pending_class_committee";
  form.updated_at = now();
  recalcScores(form);
  addLog(getUser(userId), "提交综测表", form.batch_title, "学生在信息管理页底部提交综测表");
  return formView(form);
}

const pendingStatusByRole = {
  class_committee: "pending_class_committee",
  counselor: "pending_counselor",
  student_affairs: "pending_student_affairs",
};

function canReadForm(user, form) {
  if (user.role === "student") return form.student_id === user.id;
  if (user.role === "class_committee") return form.class_id === user.class_id;
  return ["admin", "counselor", "student_affairs"].includes(user.role);
}

function listFormsByUser(user) {
  return forms.filter(form => canReadForm(user, form)).map(formView);
}

function pendingReviews(user) {
  const status = pendingStatusByRole[user.role];
  if (!status) return [];
  return forms
    .filter(form => form.status === status)
    .filter(form => canReadForm(user, form))
    .map(formView);
}

function reviewForm(id, reviewer, action, comment = "", level = "") {
  const form = forms.find(f => f.id === Number(id));
  if (!form) throw new Error("评价表不存在");
  const expected = pendingStatusByRole[reviewer.role];
  if (form.status !== expected) {
    throw new Error(`当前状态为“${STATUS_LABEL[form.status]}”，不属于${ROLE_LABEL[reviewer.role]}待评价范围`);
  }
  if (settings.requireReviewerComment && !comment) throw new Error("请填写评价意见");

  const transitions = {
    class_committee: { approve: "pending_counselor", return: "returned_by_class_committee", reject: "rejected" },
    counselor: { approve: "pending_student_affairs", return: "returned_by_counselor", reject: "rejected" },
    student_affairs: { approve: "approved", return: "returned_by_student_affairs", reject: "rejected" },
  };
  const nextStatus = transitions[reviewer.role]?.[action];
  if (!nextStatus) throw new Error("无效评价操作");

  if ((reviewer.role === "class_committee" || reviewer.role === "counselor") && action === "approve") {
    form.manual_level = level || form.manual_level || "";
    form.level = form.manual_level || calculateLevel(form.scores.total);
  }

  const record = {
    id: nextId++,
    reviewer_role: reviewer.role,
    reviewer_name: ROLE_LABEL[reviewer.role],
    action,
    action_label: action === "approve" ? "通过" : action === "return" ? "退回修改" : "不予认定",
    level: form.manual_level || form.level,
    comment,
    created_at: now(),
  };
  form.review_records.push(record);
  form.status = nextStatus;
  form.updated_at = now();
  addLog(reviewer, `${record.reviewer_name}评价`, form.student_name, `${record.action_label}：${comment || "无意见"}`);
  return formView(form);
}

function getStatistics() {
  return {
    total_students: users.filter(u => u.role === "student").length,
    submitted: forms.filter(f => f.status !== "smart_ready").length,
    approved: forms.filter(f => f.status === "approved").length,
    rejected: forms.filter(f => f.status === "rejected").length,
    returned: forms.filter(f => f.status.startsWith("returned")).length,
    pending_class_committee: forms.filter(f => f.status === "pending_class_committee").length,
    pending_counselor: forms.filter(f => f.status === "pending_counselor").length,
    pending_student_affairs: forms.filter(f => f.status === "pending_student_affairs").length,
    rows: forms.map(f => ({
      id: f.id,
      student_name: f.student_name,
      student_no: f.student_no,
      class_name: f.class_name,
      total_score: f.scores.total,
      level: f.manual_level || f.level || calculateLevel(f.scores.total),
      status: f.status,
      status_label: STATUS_LABEL[f.status],
    })),
  };
}

function exportCsv() {
  const rows = [
    ["学生姓名", "学号", "班级", "F1基本素质", "F2课程学习", "F3创新实践", "综合分", "等级", "当前状态"],
    ...forms.map(f => [
      f.student_name,
      f.student_no,
      f.class_name,
      f.scores.f1_basic_quality,
      f.scores.f2_course_learning,
      f.scores.f3_innovation_practice,
      f.scores.total,
      f.manual_level || f.level || calculateLevel(f.scores.total),
      STATUS_LABEL[f.status],
    ]),
  ];
  return "\ufeff" + rows.map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
}

module.exports = {
  ROLE_LABEL,
  STATUS_LABEL,
  formStructure,
  cloneUser,
  findUser,
  getUser,
  listBatches,
  createBatch,
  updateBatchStatus,
  getSettings,
  updateSettings,
  getSmartResult,
  getForm,
  uploadEvidence,
  updateFormItems,
  setFormLevel,
  submitSmartResult,
  listFormsByUser,
  pendingReviews,
  reviewForm,
  getStatistics,
  exportCsv,
  logs: () => clone(logs),
};
