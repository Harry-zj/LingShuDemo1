const Res = require("../utils/response");
const store = require("../mock/assessmentStore");

exports.createBatch = async (req, res) => {
  try {
    const operator = store.getUser(req.user.id);
    const batch = store.createBatch(req.body, operator);
    res.json(Res.success(batch, "管理员创建批次成功"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.getBatches = async (req, res) => {
  res.json(Res.success(store.listBatches()));
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
    if (user.role === "class_committee" && form.class_id !== user.class_id) {
      return res.json(Res.error("无权查看其他班级学生"));
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

exports.getStatistics = async (req, res) => {
  res.json(Res.success(store.getStatistics()));
};

exports.exportExcel = async (req, res) => {
  const csv = store.exportCsv();
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=assessment-summary.csv");
  res.send(csv);
};

exports.getLogs = async (req, res) => {
  res.json(Res.success(store.logs()));
};
