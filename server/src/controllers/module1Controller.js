const Res = require("../utils/response");
const store = require("../mock/assessmentStore");

exports.getSmartResult = async (req, res) => {
  try {
    res.json(Res.success(store.getSmartResult(req.user.id)));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.updateSmartResult = async (req, res) => {
  try {
    res.json(Res.success(store.updateFormItems(req.user.id, req.body), "智能填表结果已修改"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.submitSmartResult = async (req, res) => {
  try {
    res.json(Res.success(store.submitSmartResult(req.user.id), "已提交给班级测评小组评价"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.getMaterials = async (req, res) => {
  try {
    const result = store.getSmartResult(req.user.id);
    res.json(Res.success(result.grouped_items));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.createMaterial = async (req, res) => {
  res.json(Res.error("学生端不再手动填写加分项目，请从信息管理页查看和修改智能填表结果"));
};

exports.submitMaterial = async (req, res) => {
  try {
    res.json(Res.success(store.submitSmartResult(req.user.id), "智能填表结果已提交"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.uploadAttachment = async (req, res) => {
  try {
    if (!req.file) return res.json(Res.error("请选择文件"));
    const form = store.uploadEvidence(req.user.id, req.file);
    res.json(Res.success({ form }, "支撑材料上传成功，智能填表结果已刷新"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.aiMatch = async (req, res) => {
  try {
    res.json(Res.success(store.getSmartResult(req.user.id), "已返回智能填表模块生成的评价表结果"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.batchFill = async (req, res) => {
  res.json(Res.success(null, "批量智能填表接口预留，本次不实现识别算法"));
};

exports.chatFill = async (req, res) => {
  res.json(Res.success(null, "对话式智能填表接口预留，本次不实现识别算法"));
};
