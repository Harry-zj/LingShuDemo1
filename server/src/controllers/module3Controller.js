const { pool } = require("../config/database");
const Res = require("../utils/response");
const store = require("../services/module3/assessmentStore");

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
    const operator = store.getUser(req.user.id);
    const batch = store.createBatch(req.body, operator);
    res.json(Res.success(batch, "批次发布成功"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.getBatches = async (req, res) => {
  const user = store.getUser(req.user.id);
  res.json(Res.success(store.listBatches(user)));
};

exports.getStudentBatches = async (req, res) => {
  const user = store.getUser(req.user.id);
  res.json(Res.success(store.listStudentBatches(user)));
};

exports.updateBatch = async (req, res) => {
  try {
    const operator = store.getUser(req.user.id);
    res.json(Res.success(store.updateBatch(req.params.id, req.body, operator), "批次已保存"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.updateBatchStatus = async (req, res) => {
  try {
    await pool.execute("UPDATE assessment_batches SET status = ? WHERE id = ?", [req.body.status, req.params.id]);
    res.json(Res.success(null, "批次状态更新成功"));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.deleteBatch = async (req, res) => {
  try {
    const operator = store.getUser(req.user.id);
    const batch = store.updateBatchStatus(req.params.id, req.body.status, operator);
    res.json(Res.success(batch, "批次状态更新成功"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.deleteBatch = async (req, res) => {
  try {
    const operator = store.getUser(req.user.id);
    res.json(Res.success(store.deleteBatch(req.params.id, operator), "批次已删除"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
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
    const user = store.getUser(req.user.id);
    const form = store.getForm(req.params.id);
    const allowed = store.canReadForm(user, form);
    if (!allowed) return res.json(Res.error("无权查看该综测表"));
    if (user.role === "student" && Number(form.student_id) !== Number(user.id)) {
      form.review_tasks = (form.review_tasks || []).filter(task => Number(task.reviewer_id) === Number(user.id));
    }
    res.json(Res.success(form));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.setFormLevel = async (req, res) => {
  try {
    await pool.execute("UPDATE assessment_forms SET manual_level = ?, updated_at = NOW() WHERE id = ?", [req.body.level, req.params.id]);
    res.json(Res.success(null, "等级已更新"));
  } catch (e) { res.json(Res.error(e.message)); }
};

exports.reviewMaterial = async (req, res) => {
  try {
    const reviewer = store.getUser(req.user.id);
    const form = store.reviewForm(req.params.id, reviewer, req.body.action, req.body.comment || "", req.body.level || "");
    res.json(Res.success(form, "评价处理完成"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.getStudents = async (req, res) => {
  try {
    const user = store.getUser(req.user.id);
    res.json(Res.success(store.listStudents(user)));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.updateCounselorScope = async (req, res) => {
  try {
    res.json(Res.success(store.updateCounselorScope(req.user.id, req.body), "管辖范围已保存"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.setAssessmentMember = async (req, res) => {
  try {
    const operator = store.getUser(req.user.id);
    res.json(Res.success(store.setAssessmentMember(operator, req.params.id, req.body.enabled), "综测成员身份已更新"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.createTemporaryUser = async (req, res) => {
  try {
    const operator = store.getUser(req.user.id);
    res.json(Res.success(store.createTemporaryUser(req.body, operator), "临时账号已创建"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.getScopeOptions = async (req, res) => {
  const user = store.getUser(req.user.id);
  res.json(Res.success(store.getScopeOptions(user)));
};

exports.getStatistics = async (req, res) => {
  const user = store.getUser(req.user.id);
  res.json(Res.success(store.getStatistics(req.query, user)));
};

exports.exportExcel = async (req, res) => {
  const user = store.getUser(req.user.id);
  const csv = store.exportCsv(req.body || {}, user);
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=assessment-summary.csv");
  res.send(csv);
};

exports.getLogs = async (req, res) => {
  res.json(Res.success(store.logs()));
};
