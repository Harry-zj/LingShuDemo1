/**
 * 开发模式认证中间件
 * - 跳过 JWT 校验
 * - 自动注入测试用户（张三）
 * - 正式上线前请改回 ../middleware/auth
 */
module.exports = (req, res, next) => {
  req.user = {
    id: 1,
    name: '管理员',
    username: 'admin',
    role: 'admin',
  };
  next();
};
