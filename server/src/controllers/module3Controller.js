const { pool } = require("../config/database");
const Res = require("../utils/response");

// ===== 批次管理（走 MySQL） =====
exports.createBatch = async (req, res) => {
  try {
    const { title, description, start_time, end_time, requirements, status, options } = req.body;
    const [r] = await pool.execute(
      "INSERT INTO assessment_batches (title, description, start_time, end_time, requirements, status, created_by, creator_name, options) VALUES (?,?,?,?,?,?,?,?,?)",
      [title, description||"", start_time||null, end_time||null, requirements||"", status||"draft", req.user.id, req.user.username, JSON.stringify(options||{})]
    );
    res.json(Res.success({ id: r.insertId }, "批次创建成功"));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.getBatches = async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM assessment_batches ORDER BY created_at DESC");
    res.json(Res.success(rows));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.updateBatchStatus = async (req, res) => {
  try {
    await pool.execute("UPDATE assessment_batches SET status = ? WHERE id = ?", [req.body.status, req.params.id]);
    res.json(Res.success(null, "批次状态更新成功"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// ===== 系统设置 =====
exports.getSettings = async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM assessment_settings ORDER BY id");
    const settings = {};
    rows.forEach(r => {
      settings[r.setting_key] = typeof r.setting_value === 'string' ? JSON.parse(r.setting_value) : r.setting_value;
    });
    res.json(Res.success(settings));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.updateSettings = async (req, res) => {
  try {
    for (const [key, value] of Object.entries(req.body)) {
      await pool.execute(
        "INSERT INTO assessment_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)",
        [key, JSON.stringify(value)]
      );
    }
    res.json(Res.success(null, "设置已保存"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// ===== 待审核列表（按角色查询 assessment_forms） =====
exports.getPendingReviews = async (req, res) => {
  try {
    const role = req.user.role;
    const statusMap = {
      class_committee: "pending_class_committee",
      counselor: "pending_counselor",
      student_affairs: "pending_student_affairs",
    };
    const status = statusMap[role];
    if (!status) return res.json(Res.success([]));

    const [rows] = await pool.execute("SELECT * FROM assessment_forms WHERE status = ? ORDER BY updated_at DESC", [status]);
    const stMap = {
      smart_ready: '智能填表待提交', pending_class_committee: '待班级测评小组评价',
      pending_counselor: '待辅导员评价', pending_student_affairs: '待学生工作处评价',
      approved: '学生工作处认定通过', rejected: '不予认定'
    };
    const calcLv = s => s >= 85 ? '优' : s >= 75 ? '良' : s >= 60 ? '合格' : '不合格';
    const result = rows.map(f => {
      const scores = typeof f.scores === 'string' ? JSON.parse(f.scores) : f.scores;
      return {
        ...f, scores,
        level: f.manual_level || f.level || calcLv(scores.total || 0),
        status_label: stMap[f.status] || f.status
      };
    });
    res.json(Res.success(result));
  } catch (e) { res.json(Res.error(e.message)); }
};

// ===== 统计 =====
exports.getStatistics = async (req, res) => {
  try {
    const [[{total_students}]] = await pool.execute("SELECT COUNT(*) as total_students FROM users WHERE role='student'");
    const [[statusCounts]] = await pool.execute(
      "SELECT status, COUNT(*) as cnt FROM assessment_forms GROUP BY status"
    );
    const stats = { total_students };
    if (Array.isArray(statusCounts)) {
      statusCounts.forEach(s => { stats[s.status] = s.cnt; });
    }
    res.json(Res.success(stats));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.exportExcel = async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT * FROM assessment_forms ORDER BY student_name");
    const calcLv = s => s >= 85 ? '优' : s >= 75 ? '良' : s >= 60 ? '合格' : '不合格';
    const stMap = { smart_ready:'智能填表待提交',pending_class_committee:'待班级测评小组评价',pending_counselor:'待辅导员评价',pending_student_affairs:'待学生工作处评价',approved:'认定通过',rejected:'不予认定' };
    const csv = "\uFEFF" + [
      ["学生姓名","学号","班级","F1基本素质","F2课程学习","F3创新实践","综合分","等级","当前状态"].join(","),
      ...rows.map(f => {
        const s = typeof f.scores === 'string' ? JSON.parse(f.scores) : f.scores;
        return [f.student_name,f.student_no,f.class_name,s.f1_basic_quality||0,s.f2_course_learning||0,s.f3_innovation_practice||0,s.total||0,f.manual_level||f.level||calcLv(s.total||0),stMap[f.status]||f.status].map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",");
      })
    ].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=assessment-summary.csv");
    res.send(csv);
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.getLogs = async (req, res) => {
  res.json(Res.success([]));
};

// ===== 学生端综测表（走 MySQL） =====
exports.getMyMaterials = async (req, res) => {
  try {
    const [forms] = await pool.execute("SELECT * FROM assessment_forms WHERE student_id = ? ORDER BY created_at DESC", [req.user.id]);
    res.json(Res.success(forms));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.getFormDetail = async (req, res) => {
  try {
    const [forms] = await pool.execute("SELECT * FROM assessment_forms WHERE id = ?", [req.params.id]);
    if (forms.length === 0) return res.json(Res.error("评价表不存在"));
    const form = forms[0];
    const [items] = await pool.execute("SELECT * FROM assessment_form_items WHERE form_id = ? ORDER BY sort_order", [form.id]);
    const [records] = await pool.execute("SELECT * FROM assessment_review_records WHERE form_id = ? ORDER BY created_at ASC", [form.id]);
    const scores = typeof form.scores === 'string' ? JSON.parse(form.scores) : form.scores;
    const calcLv = s => s >= 85 ? '优' : s >= 75 ? '良' : s >= 60 ? '合格' : '不合格';
    const level = form.manual_level || form.level || calcLv(scores.total);
    const stMap = { smart_ready:'智能填表待提交',pending_class_committee:'待班级测评小组评价',approved:'学生工作处认定通过',rejected:'不予认定' };
    res.json(Res.success({...form,scores,level,manual_level:form.manual_level||'',status_label:stMap[form.status]||form.status,items,review_records:records}));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.setFormLevel = async (req, res) => {
  try {
    await pool.execute("UPDATE assessment_forms SET manual_level = ?, updated_at = NOW() WHERE id = ?", [req.body.level, req.params.id]);
    res.json(Res.success(null, "等级已更新"));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.reviewMaterial = async (req, res) => {
  try {
    const { action, comment, level } = req.body || {};
    const [forms] = await pool.execute("SELECT * FROM assessment_forms WHERE id = ?", [req.params.id]);
    if (forms.length === 0) return res.json(Res.error("评价表不存在"));
    const form = forms[0];
    const transitions = {
      class_committee: { approve:'pending_counselor',return:'returned_by_class_committee',reject:'rejected' },
      counselor: { approve:'pending_student_affairs',return:'returned_by_counselor',reject:'rejected' },
      student_affairs: { approve:'approved',return:'returned_by_student_affairs',reject:'rejected' }
    };
    const next = transitions[req.user.role]?.[action];
    if (!next) return res.json(Res.error("无效评价操作"));
    if ((req.user.role==='class_committee'||req.user.role==='counselor') && action==='approve' && level) {
      await pool.execute("UPDATE assessment_forms SET manual_level = ? WHERE id = ?", [level, form.id]);
    }
    const rl = { student:'学生',admin:'管理员',class_committee:'班级测评小组',counselor:'辅导员',student_affairs:'学生工作处' };
    const al = { approve:'通过',return:'退回修改',reject:'不予认定' };
    await pool.execute("INSERT INTO assessment_review_records (form_id, reviewer_role, reviewer_name, action, action_label, level, comment) VALUES (?,?,?,?,?,?,?)",
      [form.id, req.user.role, rl[req.user.role]||req.user.role, action, al[action]||action, level||'', comment||'']);
    await pool.execute("UPDATE assessment_forms SET status = ?, updated_at = NOW() WHERE id = ?", [next, form.id]);
    res.json(Res.success(null, "评价处理完成"));
  } catch (e) { res.json(Res.error(e.message)); }
};