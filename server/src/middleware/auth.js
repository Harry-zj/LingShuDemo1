const jwt = require("jsonwebtoken");
const config = require("../config");
module.exports = (req, res, next) => {
  // 优先从 Authorization header 获取 token
  let token = null;
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) {
    token = header.split(" ")[1];
  }
  // 也支持 query 参数（用于 SSE EventSource 等无法自定义 header 的场景）
  if (!token && req.query.token) {
    token = req.query.token;
  }
  if (!token) {
    return res.status(401).json({ code: 401, msg: "未登录或token已过期", data: null });
  }
  try {
    req.user = jwt.verify(token, config.jwt.secret);
    next();
  } catch (e) {
    return res.status(401).json({ code: 401, msg: "token无效", data: null });
  }
};