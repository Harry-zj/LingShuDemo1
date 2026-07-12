/**
 * 开发模式认证中间件
 * - 优先使用真实JWT校验
 * - 无token时自动注入默认测试用户
 * - 正式环境请使用 ../middleware/auth
 */
const jwt = require("jsonwebtoken");
const config = require("../config");

module.exports = (req, res, next) => {
  // 优先尝试从header提取真实JWT
  let token = null;
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    token = header.split(" ")[1];
  }
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (token) {
    try {
      req.user = jwt.verify(token, config.jwt.secret);
      return next();
    } catch (e) {
      console.warn("[devAuth] JWT校验失败，使用dev模式:", e.message);
    }
  }

  // 无token或token无效 -> dev模式注入默认用户
  req.user = {
    id: 1,
    name: '管理员',
    username: 'admin',
    role: 'admin',
  };
  const u = users[as] || users.zhangsan;
  req.user = u;
  // 不污染后续请求
  delete req.query.as;
  next();
};