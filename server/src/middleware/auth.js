const jwt = require("jsonwebtoken");
const config = require("../config");
const { pool } = require("../config/database");

module.exports = async (req, res, next) => {
  let token = null;
  const header = req.headers.authorization;
  if (header && header.startsWith("Bearer ")) token = header.split(" ")[1];
  if (!token && req.query.token) token = req.query.token;
  if (!token) {
    return res.status(401).json({ code: 401, msg: "未登录或token已过期", data: null });
  }
  try {
    const decoded = jwt.verify(token, config.jwt.secret);
    const [rows] = await pool.execute(
      "SELECT id FROM users WHERE id=? AND COALESCE(is_active,1)=1 LIMIT 1",
      [decoded.id],
    );
    if (!rows.length) {
      return res.status(401).json({ code: 401, msg: "账号已删除或停用，请重新登录", data: null });
    }
    req.user = decoded;
    return next();
  } catch (_) {
    return res.status(401).json({ code: 401, msg: "token无效", data: null });
  }
};
