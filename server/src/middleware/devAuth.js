// 开发阶段：跳过登录，自动注入测试用户
module.exports = (req, res, next) => {
  // 如果带了有效 token 就用真实用户
  const jwt = require("jsonwebtoken");
  const config = require("../config");
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    try {
      req.user = jwt.verify(header.split(" ")[1], config.jwt.secret);
      return next();
    } catch (e) { /* token无效，走dev模式 */ }
  }
  // dev 模式：默认测试用户 id=1
  req.user = { id: 1, username: "dev", role: "student" };
  next();
};
