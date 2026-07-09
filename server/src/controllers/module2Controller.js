const Res = require('../utils/response');
const store = require('../mock/assessmentStore');

exports.getEvaluation = async (req, res) => {
  try {
    const user = store.getUser(req.user.id);
    if (!user) return res.json(Res.error('用户不存在'));
    const batchId = req.query.batch_id || store.state.batches.find((b) => b.status === 'published')?.id;
    const materials = store.listMaterials(user, { batch_id: batchId }).filter((m) => m.student_id === user.id && m.status === 'approved');
    const total_score = materials.reduce((sum, m) => sum + Number(m.score || 0), 0);
    res.json(Res.success({
      student_id: user.id,
      batch_id: Number(batchId),
      total_score,
      dimension_scores: { 德育: 1.2, 智育: total_score, 体育: 0.8, 美育: 0.5, 劳育: 0.6 },
      report_content: '当前为免数据库演示数据，正式评分规则可后续扩展。',
      advice: ['继续完善证明材料归档', '关注截止时间并及时处理退回材料'],
      class_rank: 1,
      class_size: store.state.users.filter((u) => u.role === 'student' && u.class_id === user.class_id).length,
    }));
  } catch (e) { res.json(Res.error(e.message)); }
};
exports.generateReport = async (req, res) => { res.json(Res.success({ content: '综测评定报告演示内容已生成。' }, '评定报告生成成功')) };
exports.getClassStats = async (req, res) => {
  const user = store.getUser(req.user.id);
  res.json(Res.success(store.statistics(req.query.batch_id, user || { role: 'teacher' })));
};
exports.getAdvice = async (req, res) => { res.json(Res.success(['优先补齐被退回材料', '保留原始证明文件，便于老师复核'], '发展建议已生成')) };
