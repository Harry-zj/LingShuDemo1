const fs = require("fs");
const Res = require("../utils/response");
const service = require("../services/module3/service");
const adminService = require("../services/module3/adminService");

function cleanupUploadedFiles(files = []) {
  for (const file of files) {
    if (!file?.path) continue;
    try { fs.unlinkSync(file.path); } catch (_) {}
  }
}

async function currentUser(req) {
  return service.getUser(req.user.id);
}

exports.createBatch = async (req, res) => {
  try {
    res.json(Res.success(await service.createBatch(req.body, await currentUser(req)), "批次发布成功"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.getBatches = async (req, res) => {
  try {
    res.json(Res.success(await service.listBatches(await currentUser(req))));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.getStudentBatches = async (req, res) => {
  try {
    res.json(Res.success(await service.listStudentBatches(await currentUser(req))));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.ensureStudentExampleForm = async (req, res) => {
  try {
    res.json(Res.success(
      await service.ensureStudentExampleForm(req.user.id, req.body?.batch_id),
      "示例综测表已准备"
    ));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.deleteStudentExampleForm = async (req, res) => {
  try {
    res.json(Res.success(
      await service.deleteStudentExampleForm(req.user.id, req.params.batchId),
      "示例综测表已删除"
    ));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.uploadStudentSupportMaterials = async (req, res) => {
  try {
    res.json(Res.success(
      await service.uploadStudentSupportMaterials(req.user.id, req.body?.batch_id, req.files || []),
      "支撑材料已添加，请保存综测表完成项目绑定"
    ));
  } catch (error) {
    cleanupUploadedFiles(req.files || []);
    res.json(Res.error(error.message));
  }
};

exports.updateBatch = async (req, res) => {
  try {
    res.json(Res.success(await service.updateBatch(req.params.id, req.body, await currentUser(req)), "批次已保存"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.updateBatchStatus = async (req, res) => {
  try {
    res.json(Res.success(await service.updateBatchStatus(req.params.id, req.body.status, await currentUser(req)), "批次状态更新成功"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.deleteBatch = async (req, res) => {
  try {
    res.json(Res.success(await service.deleteBatch(req.params.id, await currentUser(req)), "批次已删除"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.getSettings = async (_req, res) => {
  try {
    res.json(Res.success(await service.getSettings()));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.updateSettings = async (req, res) => {
  try {
    res.json(Res.success(await service.updateSettings(req.body, await currentUser(req)), "设置已保存"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.getMyMaterials = async (req, res) => {
  try {
    res.json(Res.success(await service.listFormsByUser(await currentUser(req))));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.getFormDetail = async (req, res) => {
  try {
    res.json(Res.success(await service.getFormDetail(req.params.id, await currentUser(req))));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.setFormLevel = async (req, res) => {
  try {
    res.json(Res.success(await service.setFormLevel(req.params.id, req.body.level, await currentUser(req)), "等级已更新"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.getPendingReviews = async (req, res) => {
  try {
    res.json(Res.success(await service.getPendingReviews(await currentUser(req))));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.reviewMaterial = async (req, res) => {
  try {
    res.json(Res.success(await service.reviewForm(req.params.id, await currentUser(req), req.body || {}), "评价处理完成"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.submitObjection = async (req, res) => {
  try {
    res.json(Res.success(await service.submitObjection(req.params.id, await currentUser(req), req.body || {}), "异议已提交"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.getStudents = async (req, res) => {
  try {
    res.json(Res.success(await service.listStudents(await currentUser(req))));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.updateCounselorScope = async (req, res) => {
  try {
    res.json(Res.success(await service.updateCounselorScope(req.user.id, req.body || {}), "管辖范围已保存"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.setAssessmentMember = async (req, res) => {
  try {
    res.json(Res.success(await service.setAssessmentMember(await currentUser(req), req.params.id, req.body || {}), "评价小组身份已更新"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.getScopeOptions = async (_req, res) => {
  try {
    res.json(Res.success(await service.getScopeOptions()));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.getStatistics = async (req, res) => {
  try {
    res.json(Res.success(await service.getStatistics(req.query || {}, await currentUser(req))));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.exportExcel = async (req, res) => {
  try {
    const csv = await service.exportCsv(req.body || {}, await currentUser(req));
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=assessment-summary.csv");
    res.send(csv);
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.getLogs = async (_req, res) => {
  try {
    res.json(Res.success(await service.getLogs()));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};


exports.adminListUsers = async (req, res) => {
  try {
    res.json(Res.success(await adminService.listUsers(await currentUser(req), req.query || {})));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.adminCreateStudent = async (req, res) => {
  try {
    res.json(Res.success(await adminService.createStudentAccount(await currentUser(req), req.body || {}), "学生账号已创建"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.adminImportStudents = async (req, res) => {
  try {
    res.json(Res.success(await adminService.importStudentAccounts(await currentUser(req), req.body || {}), "导入处理完成"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.adminGenerateAccounts = async (req, res) => {
  try {
    res.json(Res.success(await adminService.generateRoleAccounts(await currentUser(req), req.body || {}), "账号已生成"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.adminResetPassword = async (req, res) => {
  try {
    res.json(Res.success(await adminService.resetPassword(await currentUser(req), req.body || {}), "密码已重置为 000000"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.getOrganizations = async (req, res) => {
  try {
    res.json(Res.success(await adminService.listOrganizations(await currentUser(req))));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.createCollege = async (req, res) => {
  try {
    res.json(Res.success(await adminService.createCollege(await currentUser(req), req.body || {}), "学院已保存"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.createMajor = async (req, res) => {
  try {
    res.json(Res.success(await adminService.createMajor(await currentUser(req), req.body || {}), "专业已保存"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.createClass = async (req, res) => {
  try {
    res.json(Res.success(await adminService.createClass(await currentUser(req), req.body || {}), "班级已保存"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.deleteCollege = async (req, res) => {
  try {
    res.json(Res.success(await adminService.deleteCollege(await currentUser(req), req.params.id), "学院已删除或停用"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.deleteMajor = async (req, res) => {
  try {
    res.json(Res.success(await adminService.deleteMajor(await currentUser(req), req.params.id), "专业已删除或停用"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};

exports.deleteClass = async (req, res) => {
  try {
    res.json(Res.success(await adminService.deleteClass(await currentUser(req), req.params.id), "班级已删除或停用"));
  } catch (error) {
    res.json(Res.error(error.message));
  }
};
