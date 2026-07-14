const bcrypt = require("bcryptjs");
const { pool } = require("../../config/database");
const module3Service = require("./service");

const ROLE_PREFIX = { counselor: "c", student_affairs: "w" };
const ROLE_LABEL = {
  student: "学生",
  counselor: "辅导员",
  student_affairs: "学生工作处",
  admin: "管理员",
};

function requireAdmin(operator) {
  if (operator.role !== "admin") throw new Error("仅管理员可操作");
}

function normalizeText(value) {
  return String(value || "").trim();
}

function normalizeClassGrade(value) {
  const matched = normalizeText(value).match(/^(\d{4})(?:级)?$/);
  if (!matched) throw new Error("请选择有效年级");
  const year = Number(matched[1]);
  if (year < 2000 || year > 2126) throw new Error("年级必须在 2000-2126 之间");
  return `${year}级`;
}

async function withTransaction(work) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally {
    conn.release();
  }
}

async function addAdminLog(conn, operator, action, target, detail) {
  await conn.execute(
    `INSERT INTO assessment_operation_logs
      (operator_id, operator_name, operator_role, action, target, detail)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [operator.id, operator.username || "管理员", operator.role, action, target || "", detail || ""]
  );
}

async function listUsers(operator, query = {}) {
  requireAdmin(operator);
  const keyword = normalizeText(query.keyword);
  const role = normalizeText(query.role);
  const params = [];
  let sql = `SELECT id, username, role, real_name, student_no, class_id, class_name, college, major, grade, phone, avatar,
                    is_assessment_member, created_at, updated_at
             FROM users WHERE role IN ('student','counselor','student_affairs','admin') AND COALESCE(is_active,1)=1`;
  if (role) {
    sql += " AND role=?";
    params.push(role);
  }
  if (keyword) {
    sql += " AND (username LIKE ? OR student_no LIKE ? OR real_name LIKE ? OR college LIKE ? OR major LIKE ? OR class_name LIKE ?)";
    const like = `%${keyword}%`;
    params.push(like, like, like, like, like, like);
  }
  sql += " ORDER BY FIELD(role,'admin','student_affairs','counselor','student'), id DESC LIMIT 500";
  const [rows] = await pool.execute(sql, params);
  return rows.map(row => ({
    ...row,
    role_name: ROLE_LABEL[row.role] || row.role,
    account: row.role === "student" ? row.student_no || row.username : row.username,
  }));
}

async function createStudentAccount(operator, data = {}) {
  requireAdmin(operator);
  const studentNo = normalizeText(data.student_no || data.username);
  if (!studentNo) throw new Error("学号不能为空");
  const [existing] = await pool.execute("SELECT id FROM users WHERE username=? OR student_no=? LIMIT 1", [studentNo, studentNo]);
  if (existing.length) throw new Error("该学号已存在");
  const password = await bcrypt.hash(studentNo, 10);
  const classId = await module3Service.ensureClass({
    name: data.class_name,
    college: data.college,
    major: data.major,
    grade: data.grade,
  });
  await withTransaction(async conn => {
    await conn.execute(
      `INSERT INTO users (username, password, role, real_name, student_no, class_id, class_name, college, major, grade, phone)
       VALUES (?, ?, 'student', ?, ?, ?, ?, ?, ?, ?, ?)`,
      [studentNo, password, data.real_name || "", studentNo, classId, data.class_name || "", data.college || "", data.major || "", data.grade || "", data.phone || ""]
    );
    await addAdminLog(conn, operator, "创建学生账号", studentNo, "管理员手动创建学生账号，初始密码为学号");
  });
  return { account: studentNo, password: studentNo };
}

async function importStudentAccounts(operator, data = {}) {
  requireAdmin(operator);
  const text = String(data.text || "");
  if (!text.trim()) throw new Error("请粘贴或上传每行一个学号的文本内容");
  const lines = text.split(/\r?\n/);
  const seen = new Set();
  const result = { success: [], duplicated: [], invalid: [], failed: [] };
  for (let i = 0; i < lines.length; i += 1) {
    const studentNo = normalizeText(lines[i]);
    const line = i + 1;
    if (!studentNo) continue;
    if (!/^[A-Za-z0-9_-]{3,30}$/.test(studentNo)) {
      result.invalid.push({ line, student_no: studentNo, reason: "学号仅支持 3-30 位字母、数字、下划线或横线" });
      continue;
    }
    if (seen.has(studentNo)) {
      result.duplicated.push({ line, student_no: studentNo, reason: "文件内重复" });
      continue;
    }
    seen.add(studentNo);
    try {
      const [existing] = await pool.execute("SELECT id FROM users WHERE username=? OR student_no=? LIMIT 1", [studentNo, studentNo]);
      if (existing.length) {
        result.duplicated.push({ line, student_no: studentNo, reason: "数据库中已存在" });
        continue;
      }
      const password = await bcrypt.hash(studentNo, 10);
      await pool.execute(
        "INSERT INTO users (username, password, role, student_no) VALUES (?, ?, 'student', ?)",
        [studentNo, password, studentNo]
      );
      result.success.push({ line, student_no: studentNo, account: studentNo, password: studentNo });
    } catch (error) {
      result.failed.push({ line, student_no: studentNo, reason: error.message });
    }
  }
  await withTransaction(async conn => {
    await addAdminLog(conn, operator, "批量导入学生账号", "学生账号", `成功 ${result.success.length} 个，重复 ${result.duplicated.length} 个，无效 ${result.invalid.length} 个，失败 ${result.failed.length} 个`);
  });
  return result;
}

async function generateUniqueAccount(conn, prefix) {
  for (let i = 0; i < 200; i += 1) {
    const body = `${new Date().getFullYear()}${Math.floor(1000 + Math.random() * 9000)}${Math.floor(Math.random() * 90 + 10)}`;
    const account = `${prefix}${body}`;
    const [rows] = await conn.execute("SELECT id FROM users WHERE username=? LIMIT 1", [account]);
    if (!rows.length) return account;
  }
  throw new Error("账号生成失败，请稍后重试");
}

async function generateRoleAccounts(operator, data = {}) {
  requireAdmin(operator);
  const role = normalizeText(data.role);
  const count = Number(data.count || 0);
  if (!ROLE_PREFIX[role]) throw new Error("只能批量生成辅导员或学生工作处账号");
  if (!Number.isInteger(count) || count < 1 || count > 200) throw new Error("创建数量必须为 1-200 的整数");
  const created = await withTransaction(async conn => {
    const list = [];
    for (let i = 0; i < count; i += 1) {
      const account = await generateUniqueAccount(conn, ROLE_PREFIX[role]);
      const password = await bcrypt.hash(account, 10);
      await conn.execute(
        "INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
        [account, password, role]
      );
      list.push({ account, password: account, role, role_name: ROLE_LABEL[role] });
    }
    await addAdminLog(conn, operator, "批量生成账号", ROLE_LABEL[role], `生成 ${count} 个账号，初始密码与账号相同`);
    return list;
  });
  return created;
}

async function resetPassword(operator, data = {}) {
  requireAdmin(operator);
  const account = normalizeText(data.account || data.username || data.student_no);
  if (!account) throw new Error("请输入需要重置的学号或账号");
  const [users] = await pool.execute("SELECT id, username, role, student_no FROM users WHERE (username=? OR student_no=?) AND COALESCE(is_active,1)=1 LIMIT 1", [account, account]);
  if (!users.length) throw new Error("账号不存在");
  const password = await bcrypt.hash("000000", 10);
  await withTransaction(async conn => {
    await conn.execute("UPDATE users SET password=? WHERE id=?", [password, users[0].id]);
    await addAdminLog(conn, operator, "重置密码", users[0].username, "密码已重置为 000000");
  });
  return { account: users[0].role === "student" ? users[0].student_no || users[0].username : users[0].username, password: "000000" };
}

async function deleteUserAccount(operator, userId) {
  requireAdmin(operator);
  const id = Number(userId || 0);
  if (!Number.isInteger(id) || id <= 0) throw new Error("账号参数无效");
  if (Number(operator.id) === id) throw new Error("不能删除当前登录的管理员账号");

  return withTransaction(async conn => {
    const [[target]] = await conn.execute(
      "SELECT id, username, student_no, role, real_name, is_active FROM users WHERE id=? LIMIT 1 FOR UPDATE",
      [id]
    );
    if (!target || Number(target.is_active) === 0) throw new Error("账号不存在或已删除");
    if (target.role === "admin") {
      const [[adminCount]] = await conn.execute(
        "SELECT COUNT(*) AS count FROM users WHERE role='admin' AND COALESCE(is_active,1)=1"
      );
      if (Number(adminCount.count || 0) <= 1) throw new Error("系统至少需要保留一个管理员账号");
    }

    await conn.execute(
      "UPDATE users SET is_active=0, deleted_at=NOW(), is_assessment_member=0 WHERE id=?",
      [id]
    );
    await conn.execute(
      "UPDATE assessment_batch_members SET status='removed', removed_at=NOW() WHERE student_id=? AND status='active'",
      [id]
    );
    await conn.execute("DELETE FROM assessment_review_assignment_members WHERE reviewer_id=?", [id]);
    await conn.execute(
      "UPDATE assessment_review_tasks SET status='cancelled', completed_at=NOW() WHERE reviewer_id=? AND status='pending'",
      [id]
    );
    await conn.execute("DELETE FROM counselor_scopes WHERE counselor_id=?", [id]);

    const account = target.role === "student" ? target.student_no || target.username : target.username;
    await addAdminLog(conn, operator, "删除账号", account, `停用${ROLE_LABEL[target.role] || target.role}账号并保留历史业务数据`);
    return { id, account, role: target.role, role_name: ROLE_LABEL[target.role] || target.role };
  });
}

async function listOrganizations(operator) {
  if (!operator) throw new Error("未登录");
  const [colleges] = await pool.execute("SELECT * FROM assessment_colleges ORDER BY is_active DESC, name");
  const [majors] = await pool.execute("SELECT m.*, c.name AS college_name FROM assessment_majors m LEFT JOIN assessment_colleges c ON c.id=m.college_id ORDER BY m.is_active DESC, c.name, m.name");
  const [classes] = await pool.execute("SELECT id, name, college, major, grade, status, created_at, updated_at FROM assessment_classes ORDER BY status, college, major, grade DESC, name");
  return { colleges, majors, classes };
}

async function createCollege(operator, data = {}) {
  requireAdmin(operator);
  const name = normalizeText(data.name);
  if (!name) throw new Error("学院名称不能为空");
  await pool.execute("INSERT INTO assessment_colleges (name) VALUES (?) ON DUPLICATE KEY UPDATE is_active=1, updated_at=CURRENT_TIMESTAMP", [name]);
  return listOrganizations(operator);
}

async function createMajor(operator, data = {}) {
  requireAdmin(operator);
  const name = normalizeText(data.name);
  const collegeId = Number(data.college_id || 0);
  if (!collegeId || !name) throw new Error("请选择学院并填写专业名称");
  await pool.execute("INSERT INTO assessment_majors (college_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE is_active=1, updated_at=CURRENT_TIMESTAMP", [collegeId, name]);
  return listOrganizations(operator);
}

async function createClass(operator, data = {}) {
  requireAdmin(operator);
  const collegeId = Number(data.college_id || 0);
  const majorId = Number(data.major_id || 0);
  const grade = normalizeClassGrade(data.grade);
  const name = normalizeText(data.name);
  if (!collegeId || !majorId || !grade || !name) throw new Error("学院、专业、年级和班级名称均不能为空");
  const [[college]] = await pool.execute("SELECT name FROM assessment_colleges WHERE id=? LIMIT 1", [collegeId]);
  const [[major]] = await pool.execute("SELECT name FROM assessment_majors WHERE id=? AND college_id=? LIMIT 1", [majorId, collegeId]);
  if (!college || !major) throw new Error("学院或专业不存在");
  await module3Service.ensureClass({ name, college: college.name, major: major.name, grade });
  return listOrganizations(operator);
}

async function hasClassReference(conn, className, college, major, grade) {
  const [[userRef]] = await conn.execute("SELECT COUNT(*) AS count FROM users WHERE class_name=? AND college=? AND grade=?", [className, college, grade]);
  const [[formRef]] = await conn.execute("SELECT COUNT(*) AS count FROM assessment_forms WHERE class_name=? AND college=? AND grade=?", [className, college, grade]);
  return Number(userRef.count || 0) + Number(formRef.count || 0) > 0;
}

async function deleteCollege(operator, id) {
  requireAdmin(operator);
  await withTransaction(async conn => {
    const [[college]] = await conn.execute("SELECT * FROM assessment_colleges WHERE id=? LIMIT 1", [Number(id)]);
    if (!college) throw new Error("学院不存在");
    const [[userRef]] = await conn.execute("SELECT COUNT(*) AS count FROM users WHERE college=?", [college.name]);
    const [[formRef]] = await conn.execute("SELECT COUNT(*) AS count FROM assessment_forms WHERE college=?", [college.name]);
    if (Number(userRef.count || 0) + Number(formRef.count || 0) > 0) {
      await conn.execute("UPDATE assessment_colleges SET is_active=0 WHERE id=?", [college.id]);
      await conn.execute("UPDATE assessment_majors SET is_active=0 WHERE college_id=?", [college.id]);
      await conn.execute("UPDATE assessment_classes SET status='inactive' WHERE college=?", [college.name]);
    } else {
      await conn.execute("DELETE FROM assessment_majors WHERE college_id=?", [college.id]);
      await conn.execute("DELETE FROM assessment_colleges WHERE id=?", [college.id]);
      await conn.execute("DELETE FROM assessment_classes WHERE college=?", [college.name]);
    }
    await addAdminLog(conn, operator, "删除学院", college.name, "无引用则物理删除，有引用则停用");
  });
  return listOrganizations(operator);
}

async function deleteMajor(operator, id) {
  requireAdmin(operator);
  await withTransaction(async conn => {
    const [[major]] = await conn.execute("SELECT m.*, c.name AS college_name FROM assessment_majors m LEFT JOIN assessment_colleges c ON c.id=m.college_id WHERE m.id=? LIMIT 1", [Number(id)]);
    if (!major) throw new Error("专业不存在");
    const [[userRef]] = await conn.execute("SELECT COUNT(*) AS count FROM users WHERE college=? AND major=?", [major.college_name, major.name]);
    const [[formRef]] = await conn.execute("SELECT COUNT(*) AS count FROM assessment_forms WHERE college=? AND major=?", [major.college_name, major.name]);
    if (Number(userRef.count || 0) + Number(formRef.count || 0) > 0) {
      await conn.execute("UPDATE assessment_majors SET is_active=0 WHERE id=?", [major.id]);
      await conn.execute("UPDATE assessment_classes SET status='inactive' WHERE college=? AND major=?", [major.college_name, major.name]);
    } else {
      await conn.execute("DELETE FROM assessment_majors WHERE id=?", [major.id]);
      await conn.execute("DELETE FROM assessment_classes WHERE college=? AND major=?", [major.college_name, major.name]);
    }
    await addAdminLog(conn, operator, "删除专业", major.name, "无引用则物理删除，有引用则停用");
  });
  return listOrganizations(operator);
}

async function deleteClass(operator, id) {
  requireAdmin(operator);
  await withTransaction(async conn => {
    const [[cls]] = await conn.execute("SELECT * FROM assessment_classes WHERE id=? LIMIT 1", [Number(id)]);
    if (!cls) throw new Error("班级不存在");
    if (await hasClassReference(conn, cls.name, cls.college, cls.major || "", cls.grade)) {
      await conn.execute("UPDATE assessment_classes SET status='inactive' WHERE id=?", [cls.id]);
    } else {
      await conn.execute("DELETE FROM assessment_classes WHERE id=?", [cls.id]);
    }
    await addAdminLog(conn, operator, "删除班级", cls.name, "无引用则物理删除，有引用则停用");
  });
  return listOrganizations(operator);
}

module.exports = {
  listUsers,
  createStudentAccount,
  importStudentAccounts,
  generateRoleAccounts,
  resetPassword,
  deleteUserAccount,
  listOrganizations,
  createCollege,
  createMajor,
  createClass,
  deleteCollege,
  deleteMajor,
  deleteClass,
};
