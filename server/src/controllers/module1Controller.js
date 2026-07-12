const { pool } = require("../config/database");
const Res = require("../utils/response");
const module3Service = require("../services/module3/service");

exports.getSmartResult = async (req, res) => {
  try {
    res.json(Res.success(await module3Service.getSmartResult(req.user.id, req.query.batch_id)));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.updateSmartResult = async (req, res) => {
  try {
    res.json(Res.success(await module3Service.updateSmartResult(req.user.id, req.body || {}), "综测信息已保存"));
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
