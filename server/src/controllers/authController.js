const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");
const config = require("../config");
const Res = require("../utils/response");
const module3Service = require("../services/module3/service");

const ROLE_LABEL = {
  student: "学生",
  admin: "管理员",
  counselor: "辅导员",
  student_affairs: "学生工作处",
};

exports.register = async (req, res) => {
  try {
    const { username, password, role, real_name, student_no, class_name, college, major, grade, phone } = req.body;
    const account = String(student_no || username || "").trim();
    if (role && role !== "student") return res.json(Res.error("辅导员、学生工作处和管理员账号不允许自主注册，请由管理员创建"));
    const settings = await module3Service.getSettings();
    if (settings.allowStudentRegister === false) return res.json(Res.error("当前系统已关闭学生自主注册，请联系管理员创建账号"));
    if (!account || !password) return res.json(Res.error("学号和密码不能为空"));
    const [existing] = await pool.execute("SELECT id FROM users WHERE username = ? OR student_no = ? LIMIT 1", [account, account]);
    if (existing.length > 0) return res.json(Res.error("该学号已存在"));
    const pwd = await bcrypt.hash(password, 10);
    const classId = await module3Service.ensureClass({ name: class_name, college, major, grade });
    await pool.execute(
      "INSERT INTO users (username, password, role, real_name, student_no, class_id, class_name, college, major, grade, phone) VALUES (?, ?, 'student', ?, ?, ?, ?, ?, ?, ?, ?)",
      [account, pwd, real_name || "", account, classId, class_name || "", college || "", major || "", grade || "", phone || ""]
    );
    res.json(Res.success(null, "注册成功，请使用学号登录"));
  } catch (e) {
    console.error("[注册] 失败:", e.message);
    res.json(Res.error(e.message));
  }
};

exports.getRegisterOptions = async (_req, res) => {
  try {
    const settings = await module3Service.getSettings();
    const [colleges] = await pool.execute("SELECT id, name FROM assessment_colleges WHERE is_active=1 ORDER BY name");
    const [majors] = await pool.execute(
      `SELECT m.id, m.name, m.college_id, c.name AS college_name
       FROM assessment_majors m
       JOIN assessment_colleges c ON c.id=m.college_id
       WHERE m.is_active=1 AND c.is_active=1
       ORDER BY c.name, m.name`
    );
    const [classes] = await pool.execute(
      "SELECT id, name, college, major, grade FROM assessment_classes WHERE COALESCE(status,'active') <> 'inactive' ORDER BY college, major, grade DESC, name"
    );
    res.json(Res.success({
      allowStudentRegister: settings.allowStudentRegister !== false,
      colleges,
      majors,
      classes,
      grades: [...new Set(classes.map(item => item.grade).filter(Boolean))].sort().reverse(),
    }));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.login = async (req, res) => {
  try {
    const { account, username, password, role } = req.body;
    const loginAccount = String(account || username || "").trim();
    if (!loginAccount || !password) return res.json(Res.error("学号/账号和密码不能为空"));
    const [rows] = await pool.execute("SELECT * FROM users WHERE username = ? OR student_no = ? LIMIT 1", [loginAccount, loginAccount]);
    if (rows.length === 0) return res.json(Res.error("学号/账号或密码错误"));
    const user = rows[0];
    if (user.role === "class_committee") {
      return res.json(Res.error("班级测评小组已不再作为独立登录身份，请使用学生账号并由辅导员设置综测成员身份"));
    }
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json(Res.error("学号/账号或密码错误"));
    if (role && role !== user.role) {
      return res.json(Res.error("该账号的角色为" + (ROLE_LABEL[user.role] || user.role) + "，与您选择的角色不匹配，请重新登录"));
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    const userInfo = await module3Service.getUser(user.id);
    res.json(Res.success({ token, user: userInfo }, "登录成功"));
  } catch (e) {
    console.error("[登录] 失败:", e.message);
    res.json(Res.error(e.message));
  }
};

exports.getProfile = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id FROM users WHERE id = ?",
      [req.user.id]
    );
    if (rows.length === 0) return res.json(Res.error("用户不存在"));
    res.json(Res.success(await module3Service.getUser(req.user.id)));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const user = await module3Service.updateUserProfile(req.user.id, req.body || {});
    res.json(Res.success(user, "个人信息已更新"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { old_password, new_password } = req.body || {};
    if (!old_password || !new_password) return res.json(Res.error("原密码和新密码不能为空"));
    if (String(new_password).length < 6) return res.json(Res.error("新密码至少需要 6 位"));
    const [rows] = await pool.execute("SELECT password FROM users WHERE id=? LIMIT 1", [req.user.id]);
    if (!rows.length) return res.json(Res.error("用户不存在"));
    const match = await bcrypt.compare(old_password, rows[0].password);
    if (!match) return res.json(Res.error("原密码不正确"));
    const pwd = await bcrypt.hash(new_password, 10);
    await pool.execute("UPDATE users SET password=? WHERE id=?", [pwd, req.user.id]);
    res.json(Res.success(null, "密码修改成功"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};
