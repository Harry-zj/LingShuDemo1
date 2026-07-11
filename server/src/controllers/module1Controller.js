const { pool } = require("../config/database");
const Res = require("../utils/response");

function calcLevel(score) {
  if (score >= 85) return '优';
  if (score >= 75) return '良';
  if (score >= 60) return '合格';
  return '不合格';
}

function formView(form, items, reviewRecords) {
  const scores = typeof form.scores === 'string' ? JSON.parse(form.scores) : form.scores;
  const level = form.manual_level || form.level || calcLevel(scores.total);
  const statusMap = {
    smart_ready: '智能填表待提交', pending_class_committee: '待班级测评小组评价',
    returned_by_class_committee: '班级测评小组退回', pending_counselor: '待辅导员评价',
    returned_by_counselor: '辅导员退回', pending_student_affairs: '待学生工作处评价',
    returned_by_student_affairs: '学生工作处退回', approved: '学生工作处认定通过', rejected: '不予认定'
  };
  const structure = [
    { key:'F1',title:'F1 基本素质评分',weight:'10%',scoreKey:'f1_basic_quality',
      children:[{key:'A1',title:'思想政治表现A1'},{key:'A2',title:'道德品质修养A2'},{key:'A3',title:'学习态度作风A3'},{key:'A4',title:'组织纪律观念A4'},{key:'A5',title:'身心健康素质A5'}]},
    { key:'F2',title:'F2 课程学习成绩评分',weight:'65%',scoreKey:'f2_course_learning', children:[{key:'COURSE',title:'课程成绩'}]},
    { key:'F3',title:'F3 创新素质与实践能力评分',weight:'25%',scoreKey:'f3_innovation_practice',
      children:[{key:'B1',title:'职业技能类B1'},{key:'B2',title:'学科竞赛类B2'},{key:'B3',title:'科研学术活动类B3'},{key:'B4',title:'文学艺术创作与宣传报道类B4'},{key:'B5',title:'社会工作类B5'},{key:'B6',title:'社会实践类B6'},{key:'B7',title:'文体艺术活动类B7'},{key:'B8',title:'劳育类B8'}]}
  ];
  const grouped_items = structure.map(s => ({...s,score:scores[s.scoreKey],
    children:s.children.map(c=>({...c,items:(items||[]).filter(it=>it.section===s.key&&it.sub_key===c.key)
      .map(it=>({...it,subKey:it.sub_key,evidence_ids:typeof it.evidence_ids==='string'?JSON.parse(it.evidence_ids):(it.evidence_ids||[])}))}))}));
  return {...form,scores,level,manual_level:form.manual_level||'',auto_level:calcLevel(scores.total),
    status_label:statusMap[form.status]||form.status,
    items:(items||[]).map(it=>({...it,subKey:it.sub_key,evidence_ids:typeof it.evidence_ids==='string'?JSON.parse(it.evidence_ids):(it.evidence_ids||[])})),
    review_records:reviewRecords||[],grouped_items};
}


exports.getSmartResult = async (req, res) => {
  try {
    const [forms] = await pool.execute("SELECT * FROM assessment_forms WHERE student_id = ? ORDER BY created_at DESC LIMIT 1", [req.user.id]);
    if (forms.length === 0) return res.json(Res.success(null));
    const form = forms[0];
    const [items] = await pool.execute("SELECT * FROM assessment_form_items WHERE form_id = ? ORDER BY sort_order", [form.id]);
    const [records] = await pool.execute("SELECT * FROM assessment_review_records WHERE form_id = ? ORDER BY created_at ASC", [form.id]);
    res.json(Res.success(formView(form, items, records)));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.updateSmartResult = async (req, res) => {
  try {
    const [forms] = await pool.execute("SELECT * FROM assessment_forms WHERE student_id = ? LIMIT 1", [req.user.id]);
    if (forms.length === 0) return res.json(Res.error("未找到智能填表结果"));
    const form = forms[0];
    const { items: newItems, personal_summary } = req.body || {};
    if (personal_summary !== undefined) await pool.execute("UPDATE assessment_forms SET personal_summary = ? WHERE id = ?", [personal_summary, form.id]);
    if (Array.isArray(newItems)) {
      const f1 = newItems.filter(i => i.section === 'F1').reduce((s, i) => s + Number(i.score || 0), 0);
      const f2 = newItems.filter(i => i.section === 'F2').reduce((s, i) => s + Number(i.score || 0), 0);
      const f3 = newItems.filter(i => i.section === 'F3').reduce((s, i) => s + Number(i.score || 0), 0);
      const scores = { f1_basic_quality: f1, f2_course_learning: f2, f3_innovation_practice: f3, total: f1 + f2 + f3 };
      await pool.execute("UPDATE assessment_forms SET scores = ?, level = ? WHERE id = ?", [JSON.stringify(scores), calcLevel(scores.total), form.id]);
      await pool.execute("DELETE FROM assessment_form_items WHERE form_id = ?", [form.id]);
      for (let i = 0; i < newItems.length; i++) {
        const it = newItems[i];
        await pool.execute("INSERT INTO assessment_form_items (form_id, section, sub_key, title, reason, score, evidence_ids, editable, sort_order) VALUES (?,?,?,?,?,?,?,?,?)",
          [form.id, it.section, it.subKey, it.title||'', it.reason||'', it.score||0, JSON.stringify(it.evidence_ids||[]), it.editable?1:0, i]);
      }
    }
    const [items] = await pool.execute("SELECT * FROM assessment_form_items WHERE form_id = ? ORDER BY sort_order", [form.id]);
    const [records] = await pool.execute("SELECT * FROM assessment_review_records WHERE form_id = ?", [form.id]);
    const [updated] = await pool.execute("SELECT * FROM assessment_forms WHERE id = ?", [form.id]);
    res.json(Res.success(formView(updated[0], items, records), "智能填表结果已修改"));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.submitSmartResult = async (req, res) => {
  try {
    const [forms] = await pool.execute("SELECT * FROM assessment_forms WHERE student_id = ? AND status = 'smart_ready' LIMIT 1", [req.user.id]);
    if (forms.length === 0) return res.json(Res.error("无可提交的智能填表结果或已提交"));
    await pool.execute("UPDATE assessment_forms SET status = 'pending_class_committee', updated_at = NOW() WHERE id = ?", [forms[0].id]);
    const [items] = await pool.execute("SELECT * FROM assessment_form_items WHERE form_id = ? ORDER BY sort_order", [forms[0].id]);
    const [records] = await pool.execute("SELECT * FROM assessment_review_records WHERE form_id = ?", [forms[0].id]);
    const [updated] = await pool.execute("SELECT * FROM assessment_forms WHERE id = ?", [forms[0].id]);
    res.json(Res.success(formView(updated[0], items, records), "已提交给班级测评小组评价"));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.getMaterials = async (req, res) => {
  try {
    const [forms] = await pool.execute("SELECT * FROM assessment_forms WHERE student_id = ? LIMIT 1", [req.user.id]);
    if (forms.length === 0) return res.json(Res.success([]));
    const [items] = await pool.execute("SELECT * FROM assessment_form_items WHERE form_id = ? ORDER BY sort_order", [forms[0].id]);
    res.json(Res.success(items));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.createMaterial = async (req, res) => { res.json(Res.error("请从信息管理页查看和修改智能填表结果")); };

exports.submitMaterial = async (req, res) => {
  try {
    const [f] = await pool.execute("SELECT * FROM assessment_forms WHERE student_id = ? AND status = 'smart_ready' LIMIT 1", [req.user.id]);
    if (f.length === 0) return res.json(Res.error("无可提交结果或已提交"));
    await pool.execute("UPDATE assessment_forms SET status = 'pending_class_committee', updated_at = NOW() WHERE id = ?", [f[0].id]);
    res.json(Res.success(null, "智能填表结果已提交"));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.uploadAttachment = async (req, res) => {
  try {
    if (!req.file) return res.json(Res.error("请选择文件"));
    const [forms] = await pool.execute("SELECT * FROM assessment_forms WHERE student_id = ? LIMIT 1", [req.user.id]);
    if (forms.length === 0) return res.json(Res.error("未找到智能填表结果"));
    const [items] = await pool.execute("SELECT * FROM assessment_form_items WHERE form_id = ?", [forms[0].id]);
    const [records] = await pool.execute("SELECT * FROM assessment_review_records WHERE form_id = ?", [forms[0].id]);
    res.json(Res.success({ form: formView(forms[0], items, records) }, "支撑材料上传成功"));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.aiMatch = async (req, res) => {
  try {
    const [forms] = await pool.execute("SELECT * FROM assessment_forms WHERE student_id = ? LIMIT 1", [req.user.id]);
    if (forms.length === 0) return res.json(Res.error("暂无智能填表结果"));
    const [items] = await pool.execute("SELECT * FROM assessment_form_items WHERE form_id = ?", [forms[0].id]);
    const [records] = await pool.execute("SELECT * FROM assessment_review_records WHERE form_id = ?", [forms[0].id]);
    res.json(Res.success(formView(forms[0], items, records), "已返回智能填表模块生成的评价表结果"));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.batchFill = async (req, res) => { res.json(Res.success(null, "批量智能填表接口预留")); };
exports.chatFill = async (req, res) => { res.json(Res.success(null, "对话式智能填表接口预留")); };
