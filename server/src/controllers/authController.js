const jwt = require("jsonwebtoken");
const config = require("../config");
const Res = require("../utils/response");
const store = require("../mock/assessmentStore");

const LOGIN_ROLES = ["student", "counselor", "student_affairs", "admin"];

exports.register = async (req, res) => {
  res.json(Res.error("免数据库演示模式暂不开放注册，请使用预置账号登录"));
};

exports.login = async (req, res) => {
  try {
    const { username, password, role } = req.body;
    if (!role || !LOGIN_ROLES.includes(role)) return res.json(Res.error("请先选择登录身份"));
    const user = store.findUser(username);
    if (!user || user.password !== password) return res.json(Res.error("用户名或密码错误"));
    if (user.role !== role) return res.json(Res.error("所选身份与账号不匹配，请重新选择"));
    const safeUser = store.cloneUser(user);
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, role_name: safeUser.role_name, is_assessment_member: !!user.is_assessment_member },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );
    res.json(Res.success({ token, user: safeUser }, "登录成功"));
  } catch (e) {
    res.json(Res.error(e.message));
  }
};

exports.getProfile = async (req, res) => {
  const user = store.getUser(req.user.id);
  res.json(Res.success(store.cloneUser(user)));
};

exports.updateProfile = async (req, res) => {
  res.json(Res.success(null, "免数据库演示模式下资料不持久保存"));
};
