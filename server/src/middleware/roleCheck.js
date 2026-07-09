module.exports = (...roles) => (req, res, next) => { if (!roles.includes(req.user.role)) { return res.status(403).json({ code: 403, msg: "权限不足", data: null }); } next(); };
