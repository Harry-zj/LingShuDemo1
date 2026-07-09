const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { pool } = require("../config/database");
const config = require("../config");
const Res = require("../utils/response");

// 注册
exports.register = async (req, res) => {
  try {
    const { username, password, role, real_name, class_id, phone } = req.body;
    const [rows] = await pool.execute("SELECT id FROM users WHERE username = ?", [username]);
    if (rows.length > 0) return res.json(Res.error("用户名已存在"));
    const pwd = await bcrypt.hash(password, 10);
    await pool.execute(
      "INSERT INTO users (username, password, role, real_name, class_id, phone) VALUES (?, ?, ?, ?, ?, ?)",
      [username, pwd, role || "student", real_name || "", class_id || null, phone || ""]
    );
    res.json(Res.success(null, "注册成功"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 登录
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const [rows] = await pool.execute("SELECT * FROM users WHERE username = ?", [username]);
    if (rows.length === 0) return res.json(Res.error("用户名或密码错误"));
    const user = rows[0];
    if (!await bcrypt.compare(password, user.password)) return res.json(Res.error("用户名或密码错误"));
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
    const { password: _, ...userInfo } = user;
    res.json(Res.success({ token, user: userInfo }, "登录成功"));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 获取个人资料
exports.getProfile = async (req, res) => {
  try {
    const [rows] = await pool.execute("SELECT id, username, role, real_name, class_id, phone, avatar, created_at FROM users WHERE id = ?", [req.user.id]);
    res.json(Res.success(rows[0]));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 更新资料
exports.updateProfile = async (req, res) => {
  try {
    const { real_name, phone, avatar } = req.body;
    await pool.execute("UPDATE users SET real_name=?, phone=?, avatar=? WHERE id=?", [real_name, phone, avatar, req.user.id]);
    res.json(Res.success(null, "更新成功"));
  } catch (e) { res.json(Res.error(e.message)); }
};
