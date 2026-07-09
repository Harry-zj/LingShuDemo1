const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const Res = require('../utils/response');
const store = require('../mock/assessmentStore');

function signToken(user) {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role, class_id: user.class_id || null },
    config.jwt.secret,
    { expiresIn: config.jwt.expiresIn }
  );
}

// 注册：免数据库模式下写入内存，重启服务后恢复演示数据
exports.register = async (req, res) => {
  try {
    const { username, password, role, real_name, class_id, phone } = req.body;
    if (!username || !password) return res.json(Res.error('用户名和密码不能为空'));
    if (store.state.users.some((u) => u.username === username)) return res.json(Res.error('用户名已存在'));
    const nextId = Math.max(...store.state.users.map((u) => u.id), 0) + 1;
    const user = {
      id: nextId,
      username,
      password: await bcrypt.hash(password, 4),
      role: role || 'student',
      real_name: real_name || username,
      class_id: class_id ? Number(class_id) : null,
      phone: phone || '',
      avatar: '',
      created_at: store.now(),
      updated_at: store.now(),
    };
    store.state.users.push(user);
    store.log(user.id, 'register', 'user', user.id, `注册用户：${user.username}`);
    res.json(Res.success(store.publicUser(user), '注册成功'));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 登录：内置演示账号 student/leader/teacher，密码均为 123456
exports.login = async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = store.state.users.find((u) => u.username === username);
    if (!user) return res.json(Res.error('用户名或密码错误'));
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.json(Res.error('用户名或密码错误'));
    const token = signToken(user);
    res.json(Res.success({ token, user: store.publicUser(user) }, '登录成功'));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 获取个人资料
exports.getProfile = async (req, res) => {
  try {
    const user = store.getUser(req.user.id);
    if (!user) return res.json(Res.error('用户不存在'));
    res.json(Res.success(store.publicUser(user)));
  } catch (e) { res.json(Res.error(e.message)); }
};

// 更新资料
exports.updateProfile = async (req, res) => {
  try {
    const user = store.getUser(req.user.id);
    if (!user) return res.json(Res.error('用户不存在'));
    const { real_name, phone, avatar, class_id } = req.body;
    user.real_name = real_name ?? user.real_name;
    user.phone = phone ?? user.phone;
    user.avatar = avatar ?? user.avatar;
    user.class_id = class_id === undefined ? user.class_id : Number(class_id) || null;
    user.updated_at = store.now();
    store.log(user.id, 'update_profile', 'user', user.id, '更新个人资料');
    res.json(Res.success(store.publicUser(user), '更新成功'));
  } catch (e) { res.json(Res.error(e.message)); }
};
