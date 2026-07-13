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
    const [forms] = await pool.execute("SELECT * FROM assessment_forms WHERE student_id = ? LIMIT 1", [req.user.id]);
    let form;
    if (forms.length === 0) {
      const [users] = await pool.execute("SELECT real_name, student_no, college, major, grade, class_name FROM users WHERE id = ?", [req.user.id]);
      if (!users.length) return res.json(Res.error("用户不存在"));
      const u = users[0];
      const [result] = await pool.execute(
        "INSERT INTO assessment_forms (batch_id, student_id, student_name, student_no, college, major, grade, class_name, from_smart_fill, status, scores) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
        [1, req.user.id, u.real_name || '', u.student_no || '', u.college || '', u.major || '', u.grade || '', u.class_name || '', 1, 'smart_ready',
         JSON.stringify({ f1_basic_quality:0, f2_course_learning:0, f3_innovation_practice:0, total:0 })]
      );
      form = { id: result.insertId, status: 'smart_ready', level: '', manual_level: '' };
    } else {
      form = forms[0];
    }
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
      // Sync to evaluation_results for personal evaluation
      const aScores={}, bScores={};
      newItems.filter(i=>i.section==='F1').forEach(i=>{aScores[i.subKey]=Number(i.score)||0});
      newItems.filter(i=>i.section==='F3').forEach(i=>{bScores[i.subKey]=Number(i.score)||0});
      const t = f1*0.1 + f2*0.65 + f3*0.25;
      const g = t>=90?'优秀':t>=80?'良好':t>=70?'中等':t>=60?'合格':'待提升';
      await pool.execute('INSERT INTO evaluation_results (user_id,batch_id,total_score,grade,formula,dimension_scores) VALUES (?,101,?,?,?,?) ON DUPLICATE KEY UPDATE total_score=VALUES(total_score),grade=VALUES(grade),dimension_scores=VALUES(dimension_scores)',
        [req.user.id, parseFloat(t.toFixed(2)), g, 'F=F1*0.1+F2*0.65+F3*0.25', JSON.stringify({aScores,bScores,scores:{F1:f1,F2:f2,F3:f3},classAvg:{},rank:0,totalStudents:0})]);
    }
    const [items] = await pool.execute("SELECT * FROM assessment_form_items WHERE form_id = ? ORDER BY sort_order", [form.id]);
    const [records] = await pool.execute("SELECT * FROM assessment_review_records WHERE form_id = ?", [form.id]);
    const [updated] = await pool.execute("SELECT * FROM assessment_forms WHERE id = ?", [form.id]);
    res.json(Res.success(formView(updated[0], items, records), "智能填表结果已修改"));
  } catch (e) { res.json(Res.error(e.message)); }
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
