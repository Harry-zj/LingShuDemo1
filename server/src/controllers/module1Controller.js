const { pool } = require("../config/database");
const Res = require("../utils/response");
const module3Service = require("../services/module3/service");

function formView(form, items, records) {
  if (!form) return null;
  let scores = { f1_basic_quality: 0, f2_course_learning: 0, f3_innovation_practice: 0, total: 0 };
  try { scores = typeof form.scores === 'string' ? JSON.parse(form.scores) : (form.scores || scores); } catch (_) {}
  return {
    id: form.id,
    batch_id: form.batch_id,
    student_id: form.student_id,
    student_name: form.student_name,
    student_no: form.student_no,
    college: form.college,
    major: form.major,
    grade: form.grade,
    class_name: form.class_name,
    status: form.status,
    level: form.level || calcLevel(scores.total || 0),
    manual_level: form.manual_level || '',
    scores,
    items: items || [],
    review_records: records || [],
  };
}

function calcLevel(total) {
  if (total >= 90) return '优秀';
  if (total >= 80) return '良好';
  if (total >= 70) return '中等';
  if (total >= 60) return '合格';
  return '待提升';
}

exports.getSmartResult = async (req, res) => {
  try {
    res.json(Res.success(await module3Service.getSmartResult(req.user.id, req.query.batch_id)));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.updateSmartResult = async (req, res) => {
  try {
    const result = await module3Service.updateSmartResult(req.user.id, req.body || {});
    res.json(Res.success(result, "智能填表结果已修改"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.submitSmartResult = async (req, res) => {
  try {
    res.json(Res.success(await module3Service.submitSmartResult(req.user.id, req.body || {}), "已提交并分配给跨班综测成员评价"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.getMaterials = async (req, res) => {
  try {
    const form = await module3Service.getSmartResult(req.user.id, req.query.batch_id);
    res.json(Res.success(form?.grouped_items || []));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.createMaterial = async (_req, res) => {
  res.json(Res.error("请从信息管理页查看和修改智能填表结果"));
};

exports.submitMaterial = async (req, res) => {
  try {
    res.json(Res.success(await module3Service.submitSmartResult(req.user.id, req.body || {}), "智能填表结果已提交"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.uploadAttachment = async (req, res) => {
  try {
    if (!req.file) return res.json(Res.error("请选择文件"));
    const batchId = req.body.batch_id;
    if (!batchId) return res.json(Res.error("请先选择综测批次"));
    const form = await module3Service.getSmartResult(req.user.id, batchId);
    if (!form) return res.json(Res.error("当前批次暂无智能填表结果"));
    res.json(Res.success({ form }, "支撑材料已上传；材料识别和写入仍由智能填表模块处理"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.aiMatch = async (req, res) => {
  try {
    const form = await module3Service.getSmartResult(req.user.id, req.body.batch_id);
    res.json(Res.success(form, "已返回智能填表模块生成的评价表结果"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.batchFill = async (_req, res) => {
  res.json(Res.success(null, "批量智能填表接口预留"));
};

exports.chatFill = async (_req, res) => {
  res.json(Res.success(null, "对话式智能填表接口预留"));
};
