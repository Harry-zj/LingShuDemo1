const jwt = require("jsonwebtoken");
const config = require("../config");
const Res = require("../utils/response");
const store = require("../mock/assessmentStore");

exports.register = async (req, res) => {
  res.json(Res.error("免数据库演示模式暂不开放注册，请使用预置账号登录"));
};

exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = store.findUser(username);
    if (!user || user.password !== password) return res.json(Res.error("用户名或密码错误"));
    const safeUser = store.cloneUser(user);
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role, role_name: safeUser.role_name },
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
