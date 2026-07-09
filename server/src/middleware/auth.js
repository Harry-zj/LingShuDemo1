const jwt = require("jsonwebtoken");
const config = require("../config");
module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ code: 401, msg: "未登录或token已过期", data: null });
  }
  try {
    req.user = jwt.verify(header.split(" ")[1], config.jwt.secret);
    next();
  } catch (e) {
    return res.status(401).json({ code: 401, msg: "token无效", data: null });
  }
};
