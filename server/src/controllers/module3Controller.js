const Res = require('../utils/response');
const store = require('../mock/assessmentStore');

function currentUser(req) {
  return store.getUser(req.user.id);
}

// 创建综测批次
exports.createBatch = async (req, res) => {
  try {
    const user = currentUser(req);
    const { title, start_time, end_time } = req.body;
    if (!title || !start_time || !end_time) return res.json(Res.error('批次名称、开始时间和截止时间不能为空'));
    const batch = store.createBatch(user, req.body);
    res.json(Res.success(batch, '批次创建成功'));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 获取批次列表
exports.getBatches = async (req, res) => {
  try { res.json(Res.success(store.listBatches())); }
  catch (e) { res.json(Res.error(e.message)); }
};

// 编辑批次基本信息
exports.updateBatch = async (req, res) => {
  try {
    const user = currentUser(req);
    const batch = store.updateBatch(user, req.params.id, req.body);
    if (!batch) return res.json(Res.error('批次不存在'));
    res.json(Res.success(batch, '批次更新成功'));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 发布、关闭、归档批次
exports.updateBatchStatus = async (req, res) => {
  try {
    const user = currentUser(req);
    const { status } = req.body;
    if (!['draft', 'published', 'closed', 'archived'].includes(status)) return res.json(Res.error('批次状态无效'));
    const batch = store.updateBatchStatus(user, req.params.id, status);
    if (!batch) return res.json(Res.error('批次不存在'));
    res.json(Res.success(batch, '状态更新成功'));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 我的材料 / 按权限查看材料
exports.getMyMaterials = async (req, res) => {
  try {
    const user = currentUser(req);
    if (!user) return res.json(Res.error('用户不存在'));
    res.json(Res.success(store.listMaterials(user, req.query)));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 待审核列表：班干部看本班待初审，老师看待复核
exports.getPendingReviews = async (req, res) => {
  try {
    const user = currentUser(req);
    if (!user) return res.json(Res.error('用户不存在'));
    res.json(Res.success(store.getPendingReviews(user, req.query)));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 审核材料：通过、退回、驳回，并记录审核意见、通知和操作日志
exports.reviewMaterial = async (req, res) => {
  try {
    const user = currentUser(req);
    if (!user) return res.json(Res.error('用户不存在'));
    const { action, comment } = req.body;
    const material = store.reviewMaterial(user, req.params.id, action, comment || '');
    res.json(Res.success(material, '审核完成'));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 统计：提交人数、未提交名单、待审核数、通过数、退回数、班级进度
exports.getStatistics = async (req, res) => {
  try {
    const user = currentUser(req);
    if (!user) return res.json(Res.error('用户不存在'));
    res.json(Res.success(store.statistics(req.query.batch_id, user)));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 导出 Excel：当前无第三方 Excel 依赖，先生成可被 Excel 打开的 CSV 内容
exports.exportExcel = async (req, res) => {
  try {
    const user = currentUser(req);
    if (!user) return res.json(Res.error('用户不存在'));
    const batchId = req.body.batch_id || req.query.batch_id;
    const batch = store.getBatch(batchId);
    const content = '\uFEFF' + store.exportCsv(batchId, user);
    store.log(user.id, 'export_summary', 'batch', Number(batchId), `导出综测汇总：${batch?.title || batchId}`);
    res.json(Res.success({
      fileName: `${batch?.title || '综测批次'}-汇总表.csv`,
      mimeType: 'text/csv;charset=utf-8',
      content,
    }, '导出文件已生成'));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.getClasses = async (req, res) => {
  try { res.json(Res.success(store.listClasses())); }
  catch (e) { res.json(Res.error(e.message)); }
};

exports.getUsers = async (req, res) => {
  try { res.json(Res.success(store.listUsers(req.query))); }
  catch (e) { res.json(Res.error(e.message)); }
};

exports.setClassLeader = async (req, res) => {
  try {
    const user = currentUser(req);
    const result = store.setClassLeader(user, req.params.id, req.body.leader_id);
    res.json(Res.success(result, '班干部设置成功'));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.getNotifications = async (req, res) => {
  try {
    const user = currentUser(req);
    if (!user) return res.json(Res.error('用户不存在'));
    res.json(Res.success(store.listNotifications(user)));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.getLogs = async (req, res) => {
  try {
    const user = currentUser(req);
    if (!user) return res.json(Res.error('用户不存在'));
    if (user.role !== 'teacher') return res.status(403).json(Res.error('只有老师可以查看操作日志'));
    res.json(Res.success(store.listLogs(user, req.query)));
  } catch (e) { res.json(Res.error(e.message)); }
};
