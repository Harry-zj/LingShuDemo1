const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");
const config = require("../config");
const Res = require("../utils/response");

const ROLE_LABEL = {
  student: "学生",
  admin: "管理员",
  class_committee: "班级测评小组",
  counselor: "辅导员",
  student_affairs: "学生工作处",
};

exports.register = async (req, res) => {
  try {
    const { username, password, role, real_name, student_no, class_name, college, major, grade, phone } = req.body;
    if (!username || !password) return res.json(Res.error("用户名和密码不能为空"));
    if (!role) return res.json(Res.error("请选择角色"));
    const validRoles = Object.keys(ROLE_LABEL);
    if (!validRoles.includes(role)) {
      return res.json(Res.error("无效的角色类型，可选角色：" + validRoles.join("、")));
    }
    const [existing] = await pool.execute("SELECT id FROM users WHERE username = ?", [username]);
    if (existing.length > 0) return res.json(Res.error("用户名已存在"));
    const pwd = await bcrypt.hash(password, 10);
    await pool.execute(
      "INSERT INTO users (username, password, role, real_name, student_no, class_name, college, major, grade, phone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [username, pwd, role, real_name || "", student_no || null, class_name || "", college || "", major || "", grade || "", phone || ""]
    );
    res.json(Res.success(null, "注册成功，请登录"));
  } catch (e) {
    console.error("[注册] 失败:", e.message);
    res.json(Res.error(e.message));
  }
};

exports.login = async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!username || !password) return res.json(Res.error("用户名和密码不能为空"));
    const [rows] = await pool.execute("SELECT * FROM users WHERE username = ?", [username]);
    if (rows.length === 0) return res.json(Res.error("用户名或密码错误"));
    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.json(Res.error("用户名或密码错误"));
    if (role && role !== user.role) {
      return res.json(Res.error("该账号的角色为" + (ROLE_LABEL[user.role] || user.role) + "，与您选择的角色不匹配，请重新登录"));
    }
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, role_name: safeUser.role_name },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    const { password: _, ...userInfo } = user;
    userInfo.role_name = ROLE_LABEL[user.role] || user.role;
    res.json(Res.success({ token, user: userInfo }, "登录成功"));
  } catch (e) {
    console.error("[登录] 失败:", e.message);
    res.json(Res.error(e.message));
  }
};

exports.getProfile = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      "SELECT id, username, role, real_name, student_no, class_name, college, major, grade, phone, avatar, created_at FROM users WHERE id = ?",
      [req.user.id]
    );
    if (rows.length === 0) return res.json(Res.error("用户不存在"));
    res.json(Res.success(rows[0]));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { real_name, phone, avatar } = req.body;
    await pool.execute("UPDATE users SET real_name=?, phone=?, avatar=? WHERE id=?", [real_name || "", phone || "", avatar || "", req.user.id]);
    res.json(Res.success(null, "更新成功"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};
