const bcrypt = require("bcryptjs");

const now = () => new Date().toISOString().slice(0, 19).replace("T", " ");

const counters = {
  users: 4,
  classes: 1,
  batches: 2,
  materials: 2,
  attachments: 1,
  review_records: 1,
  evaluation_results: 1,
  notifications: 1,
  operation_logs: 1,
  projects: 2,
  project_members: 4,
  submissions: 2,
  submission_attachments: 1,
  audit_records: 1,
  add_codes: 2
};

const hash = bcrypt.hashSync("123456", 10);

const db = {
  users: [
    { id: 1, username: "student", password: hash, role: "student", real_name: "学生用户", class_id: 1, phone: "", avatar: "", created_at: now(), updated_at: now() },
    { id: 2, username: "leader", password: hash, role: "class_leader", real_name: "班干部", class_id: 1, phone: "", avatar: "", created_at: now(), updated_at: now() },
    { id: 3, username: "teacher", password: hash, role: "teacher", real_name: "教师用户", class_id: null, phone: "", avatar: "", created_at: now(), updated_at: now() }
  ],
  classes: [{ id: 1, name: "示例班级", major: "软件工程", grade: "2023", teacher_id: 3, created_at: now() }],
  batches: [
    { id: 1, title: "示例材料收集项目", description: "用于演示无数据库模式", start_time: now(), end_time: "2099-12-31 23:59:59", status: "published", requirements: "请按要求提交材料", created_by: 3, created_at: now(), updated_at: now() }
  ],
  materials: [
    { id: 1, batch_id: 1, student_id: 1, title: "示例获奖材料", category: "竞赛", status: "draft", score: 0, rule_match: null, ai_confidence: null, submit_time: null, created_at: now(), updated_at: now() }
  ],
  attachments: [],
  review_records: [],
  evaluation_results: [],
  notifications: [],
  operation_logs: [],
  projects: [
    { id: 1, title: "示例材料收集项目", description: "用户可通过添加码加入并提交材料", start_time: now(), end_time: "2099-12-31 23:59:59", status: "published", rules: "支持草稿、提交、审核、退回和重新提交", add_code: "DEMO2026", add_code_enabled: true, add_code_limit: 200, created_by: 3, created_at: now(), updated_at: now() }
  ],
  project_members: [
    { id: 1, project_id: 1, user_id: 1, role: "submitter", created_at: now() },
    { id: 2, project_id: 1, user_id: 2, role: "reviewer", created_at: now() },
    { id: 3, project_id: 1, user_id: 3, role: "admin", created_at: now() }
  ],
  submissions: [
    { id: 1, project_id: 1, user_id: 1, title: "示例获奖材料", content: { category: "竞赛", description: "这里是示例内容" }, status: "draft", review_comment: "", submit_time: null, created_at: now(), updated_at: now() }
  ],
  submission_attachments: [],
  audit_records: [],
  add_codes: [{ id: 1, project_id: 1, code: "DEMO2026", enabled: true, max_members: 200, created_at: now(), updated_at: now() }]
};

function nextId(name) {
  counters[name] = (counters[name] || 1) + 1;
  return counters[name] - 1;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function countProjectMembers(projectId) {
  return db.project_members.filter(m => Number(m.project_id) === Number(projectId)).length;
}

function getProjectRole(projectId, userId) {
  const member = db.project_members.find(m => Number(m.project_id) === Number(projectId) && Number(m.user_id) === Number(userId));
  return member?.role || null;
}

function canManageProject(projectId, user) {
  if (!user) return false;
  if (user.role === "teacher") return true;
  return getProjectRole(projectId, user.id) === "admin";
}

function canReviewProject(projectId, user) {
  if (!user) return false;
  if (user.role === "teacher" || user.role === "class_leader") return true;
  const role = getProjectRole(projectId, user.id);
  return role === "admin" || role === "reviewer";
}

function canAccessProject(projectId, user) {
  if (!user) return false;
  return canReviewProject(projectId, user) || Boolean(getProjectRole(projectId, user.id));
}

function recordLog(userId, action, targetType, targetId, detail = "") {
  db.operation_logs.push({ id: nextId("operation_logs"), user_id: userId || 0, action, target_type: targetType, target_id: targetId || null, detail, created_at: now() });
}

function notify(userId, title, content) {
  db.notifications.push({ id: nextId("notifications"), user_id: userId, title, content, is_read: 0, created_at: now() });
}

async function execute(sql, params = []) {
  const normalized = String(sql).replace(/\s+/g, " ").trim();

  // authController
  if (normalized.startsWith("SELECT id FROM users WHERE username = ?")) {
    return [clone(db.users.filter(u => u.username === params[0]).map(u => ({ id: u.id })))];
  }
  if (normalized.startsWith("INSERT INTO users")) {
    const [username, password, role, realName, classId, phone] = params;
    const id = nextId("users");
    db.users.push({ id, username, password, role: role || "student", real_name: realName || "", class_id: classId || null, phone: phone || "", avatar: "", created_at: now(), updated_at: now() });
    return [{ insertId: id, affectedRows: 1 }];
  }
  if (normalized.startsWith("SELECT * FROM users WHERE username = ?")) {
    return [clone(db.users.filter(u => u.username === params[0]))];
  }
  if (normalized.startsWith("SELECT id, username, role, real_name, class_id, phone, avatar, created_at FROM users WHERE id = ?")) {
    return [clone(db.users.filter(u => Number(u.id) === Number(params[0])).map(({ id, username, role, real_name, class_id, phone, avatar, created_at }) => ({ id, username, role, real_name, class_id, phone, avatar, created_at })))];
  }
  if (normalized.startsWith("UPDATE users SET real_name=?, phone=?, avatar=? WHERE id=?")) {
    const [realName, phone, avatar, id] = params;
    const user = db.users.find(u => Number(u.id) === Number(id));
    if (user) Object.assign(user, { real_name: realName || "", phone: phone || "", avatar: avatar || "", updated_at: now() });
    return [{ affectedRows: user ? 1 : 0 }];
  }

  // module1Controller
  if (normalized.startsWith("SELECT m.*, u.real_name as student_name FROM materials m JOIN users u ON m.student_id = u.id WHERE 1=1")) {
    const batchId = params[0];
    let rows = db.materials.map(m => ({ ...m, student_name: db.users.find(u => u.id === m.student_id)?.real_name || "" }));
    if (batchId) rows = rows.filter(m => Number(m.batch_id) === Number(batchId));
    rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return [clone(rows)];
  }
  if (normalized.startsWith("INSERT INTO materials (batch_id, student_id, title, category) VALUES")) {
    const [batchId, studentId, title, category] = params;
    const id = nextId("materials");
    db.materials.push({ id, batch_id: Number(batchId), student_id: Number(studentId), title, category: category || "", status: "draft", score: 0, rule_match: null, ai_confidence: null, submit_time: null, created_at: now(), updated_at: now() });
    return [{ insertId: id, affectedRows: 1 }];
  }
  if (normalized.startsWith("UPDATE materials SET status='pending_class_leader', submit_time=NOW() WHERE id=? AND student_id=?")) {
    const [id, studentId] = params;
    const material = db.materials.find(m => Number(m.id) === Number(id) && Number(m.student_id) === Number(studentId));
    if (material) Object.assign(material, { status: "pending_class_leader", submit_time: now(), updated_at: now() });
    return [{ affectedRows: material ? 1 : 0 }];
  }
  if (normalized.startsWith("INSERT INTO attachments")) {
    const [materialId, fileName, filePath, fileType, fileSize] = params;
    const id = nextId("attachments");
    db.attachments.push({ id, material_id: Number(materialId), file_name: fileName, file_path: filePath, file_type: fileType || "", file_size: fileSize || 0, ai_label: "", created_at: now() });
    return [{ insertId: id, affectedRows: 1 }];
  }

  // module2Controller
  if (normalized.startsWith("SELECT * FROM evaluation_results WHERE student_id = ?")) {
    const [studentId, batchId] = params;
    let rows = db.evaluation_results.filter(r => Number(r.student_id) === Number(studentId));
    if (batchId) rows = rows.filter(r => Number(r.batch_id) === Number(batchId));
    rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return [clone(rows.slice(0, 1))];
  }

  // module3Controller
  if (normalized.startsWith("INSERT INTO batches")) {
    const [title, description, startTime, endTime, requirements, createdBy] = params;
    const id = nextId("batches");
    db.batches.push({ id, title, description: description || "", start_time: startTime, end_time: endTime, status: "draft", requirements: requirements || "", created_by: Number(createdBy), created_at: now(), updated_at: now() });
    return [{ insertId: id, affectedRows: 1 }];
  }
  if (normalized.startsWith("SELECT * FROM batches ORDER BY created_at DESC")) {
    const rows = [...db.batches].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return [clone(rows)];
  }
  if (normalized.startsWith("UPDATE batches SET status = ? WHERE id = ?")) {
    const [status, id] = params;
    const batch = db.batches.find(b => Number(b.id) === Number(id));
    if (batch) Object.assign(batch, { status, updated_at: now() });
    return [{ affectedRows: batch ? 1 : 0 }];
  }
  if (normalized.startsWith("UPDATE materials SET status = ? WHERE id = ?")) {
    const [status, id] = params;
    const material = db.materials.find(m => Number(m.id) === Number(id));
    if (material) Object.assign(material, { status, updated_at: now() });
    return [{ affectedRows: material ? 1 : 0 }];
  }
  if (normalized.startsWith("INSERT INTO review_records")) {
    const [materialId, reviewerId, reviewerRole, action, comment] = params;
    const id = nextId("review_records");
    db.review_records.push({ id, material_id: Number(materialId), reviewer_id: Number(reviewerId), reviewer_role: reviewerRole, action, comment: comment || "", created_at: now() });
    return [{ insertId: id, affectedRows: 1 }];
  }
  if (normalized.startsWith("SELECT * FROM materials WHERE student_id = ?")) {
    const [studentId, batchId] = params;
    let rows = db.materials.filter(m => Number(m.student_id) === Number(studentId));
    if (batchId) rows = rows.filter(m => Number(m.batch_id) === Number(batchId));
    rows.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return [clone(rows)];
  }
  if (normalized.startsWith("SELECT m.*, u.real_name as student_name FROM materials m JOIN users u ON m.student_id = u.id WHERE m.status = ?")) {
    const [status] = params;
    const rows = db.materials
      .filter(m => m.status === status)
      .map(m => ({ ...m, student_name: db.users.find(u => u.id === m.student_id)?.real_name || "" }))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    return [clone(rows)];
  }
  if (normalized.startsWith("SELECT status, COUNT(*) as count FROM materials WHERE batch_id = ? GROUP BY status")) {
    const [batchId] = params;
    const map = new Map();
    db.materials.filter(m => Number(m.batch_id) === Number(batchId)).forEach(m => map.set(m.status, (map.get(m.status) || 0) + 1));
    return [Array.from(map, ([status, count]) => ({ status, count }))];
  }

  console.warn(`[MemoryDB] 未匹配的 SQL：${normalized}`);
  return [[]];
}

const memoryPool = { execute };

module.exports = {
  db,
  memoryPool,
  nextId,
  now,
  clone,
  getProjectRole,
  canManageProject,
  canReviewProject,
  canAccessProject,
  countProjectMembers,
  recordLog,
  notify
};
