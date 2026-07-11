const Res = require("../utils/response");
const store = require("../services/module3/assessmentStore");

exports.createBatch = async (req, res) => {
  try {
    const operator = store.getUser(req.user.id);
    const batch = store.createBatch(req.body, operator);
    res.json(Res.success(batch, "批次发布成功"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.getBatches = async (req, res) => {
  const user = store.getUser(req.user.id);
  res.json(Res.success(store.listBatches(user)));
};

exports.getStudentBatches = async (req, res) => {
  const user = store.getUser(req.user.id);
  res.json(Res.success(store.listStudentBatches(user)));
};

exports.updateBatch = async (req, res) => {
  try {
    const operator = store.getUser(req.user.id);
    res.json(Res.success(store.updateBatch(req.params.id, req.body, operator), "批次已保存"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.updateBatchStatus = async (req, res) => {
  try {
    const operator = store.getUser(req.user.id);
    const batch = store.updateBatchStatus(req.params.id, req.body.status, operator);
    res.json(Res.success(batch, "批次状态更新成功"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.deleteBatch = async (req, res) => {
  try {
    const operator = store.getUser(req.user.id);
    res.json(Res.success(store.deleteBatch(req.params.id, operator), "批次已删除"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.getSettings = async (req, res) => {
  res.json(Res.success(store.getSettings()));
};

exports.updateSettings = async (req, res) => {
  try {
    const operator = store.getUser(req.user.id);
    res.json(Res.success(store.updateSettings(req.body, operator), "设置已保存"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.getMyMaterials = async (req, res) => {
  try {
    const user = store.getUser(req.user.id);
    res.json(Res.success(store.listFormsByUser(user)));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.getFormDetail = async (req, res) => {
  try {
    const user = store.getUser(req.user.id);
    const form = store.getForm(req.params.id);
    const allowed = store.canReadForm(user, form);
    if (!allowed) return res.json(Res.error("无权查看该综测表"));
    if (user.role === "student" && Number(form.student_id) !== Number(user.id)) {
      form.review_tasks = (form.review_tasks || []).filter(task => Number(task.reviewer_id) === Number(user.id));
    }
    res.json(Res.success(form));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.setFormLevel = async (req, res) => {
  try {
    const operator = store.getUser(req.user.id);
    res.json(Res.success(store.setFormLevel(req.params.id, req.body.level, operator), "等级已更新"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.getPendingReviews = async (req, res) => {
  try {
    const user = store.getUser(req.user.id);
    res.json(Res.success(store.pendingReviews(user)));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.reviewMaterial = async (req, res) => {
  try {
    const reviewer = store.getUser(req.user.id);
    const form = store.reviewForm(req.params.id, reviewer, req.body.action, req.body.comment || "", req.body.level || "");
    res.json(Res.success(form, "评价处理完成"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.getStudents = async (req, res) => {
  try {
    const user = store.getUser(req.user.id);
    res.json(Res.success(store.listStudents(user)));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.updateCounselorScope = async (req, res) => {
  try {
    res.json(Res.success(store.updateCounselorScope(req.user.id, req.body), "管辖范围已保存"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.setAssessmentMember = async (req, res) => {
  try {
    const operator = store.getUser(req.user.id);
    res.json(Res.success(store.setAssessmentMember(operator, req.params.id, req.body.enabled), "综测成员身份已更新"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.createTemporaryUser = async (req, res) => {
  try {
    const operator = store.getUser(req.user.id);
    res.json(Res.success(store.createTemporaryUser(req.body, operator), "临时账号已创建"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.getScopeOptions = async (req, res) => {
  const user = store.getUser(req.user.id);
  res.json(Res.success(store.getScopeOptions(user)));
};

exports.getStatistics = async (req, res) => {
  const user = store.getUser(req.user.id);
  res.json(Res.success(store.getStatistics(req.query, user)));
};

exports.exportExcel = async (req, res) => {
  const user = store.getUser(req.user.id);
  const csv = store.exportCsv(req.body || {}, user);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=assessment-summary.csv");
  res.send(csv);
};

exports.getLogs = async (req, res) => {
  res.json(Res.success(store.logs()));
};
