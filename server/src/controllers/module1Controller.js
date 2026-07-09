const Res = require('../utils/response');
const store = require('../mock/assessmentStore');

function currentUser(req) {
  return store.getUser(req.user.id);
}

// 获取材料列表：学生只看本人，班干部只看本班，老师看负责范围内全部演示数据
exports.getMaterials = async (req, res) => {
  try {
    const user = currentUser(req);
    if (!user) return res.json(Res.error('用户不存在'));
    const rows = store.listMaterials(user, req.query);
    res.json(Res.success(rows));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 获取材料详情：包含附件和审核记录
exports.getMaterialDetail = async (req, res) => {
  try {
    const user = currentUser(req);
    const material = store.decorateMaterial(store.getMaterial(req.params.id));
    if (!material) return res.json(Res.error('材料不存在'));
    if (!store.canAccessMaterial(user, material)) return res.status(403).json(Res.error('无权访问该材料'));
    res.json(Res.success(material));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 保存材料草稿
exports.createMaterial = async (req, res) => {
  try {
    const user = currentUser(req);
    if (!user) return res.json(Res.error('用户不存在'));
    if (user.role !== 'student') return res.json(Res.error('只有学生可以提交综测材料'));
    const { batch_id, title } = req.body;
    if (!batch_id || !title) return res.json(Res.error('批次和材料标题不能为空'));
    const material = store.createMaterial(user, req.body);
    res.json(Res.success(material, '草稿保存成功'));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 修改草稿或被退回材料
exports.updateMaterial = async (req, res) => {
  try {
    const user = currentUser(req);
    if (!user) return res.json(Res.error('用户不存在'));
    const material = store.updateMaterial(user, req.params.id, req.body);
    res.json(Res.success(material, '材料修改成功'));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 正式提交材料：进入“待班干部审核”状态
exports.submitMaterial = async (req, res) => {
  try {
    const user = currentUser(req);
    if (!user) return res.json(Res.error('用户不存在'));
    const material = store.submitMaterial(user, req.params.id);
    res.json(Res.success(material, '提交成功，等待班干部初审'));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 上传附件：支持图片、PDF、Word、Excel，文件大小由 upload 中间件限制
exports.uploadAttachment = async (req, res) => {
  try {
    if (!req.file) return res.json(Res.error('请选择文件'));
    const user = currentUser(req);
    if (!user) return res.json(Res.error('用户不存在'));
    const { material_id } = req.body;
    if (!material_id) return res.json(Res.error('缺少 material_id'));
    const attachment = store.addAttachment(user, material_id, req.file);
    res.json(Res.success(attachment, '上传成功'));
  } catch (e) { res.json(Res.error(e.message)); }
};

// AI智能匹配（预留）：返回可用于填报预览的演示匹配结果
exports.aiMatch = async (req, res) => {
  try {
    const { material_id } = req.body;
    const material = material_id ? store.decorateMaterial(store.getMaterial(material_id)) : null;
    res.json(Res.success({
      material_id: material?.id || null,
      category: material?.category || '待识别',
      suggested_score: material?.score || 0,
      confidence: material ? 0.86 : 0,
      tips: material ? ['已根据标题和附件类型生成初步匹配结果', '正式分值仍以班干部初审和老师复核为准'] : ['请选择一个材料后再进行匹配'],
    }, 'AI匹配演示结果已生成'));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 批量填表（预留）
exports.batchFill = async (req, res) => { res.json(Res.success(null, '批量填表功能待扩展')) };
// 对话填表（预留）
exports.chatFill = async (req, res) => { res.json(Res.success(null, '对话填表功能待扩展')) };
