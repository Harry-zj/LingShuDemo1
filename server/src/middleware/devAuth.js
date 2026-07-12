/**
 * 开发模式认证中间件
 * - 跳过 JWT 校验
 * - 自动注入测试用户（张三）
 * - 正式上线前请改回 ../middleware/auth
 */
module.exports = (req, res, next) => {
  // 可通过 query 参数切换角色：?as=admin / ?as=zhangsan / ?as=counselor 等
  const as = req.query.as || 'zhangsan';
  const users = {
    zhangsan:  { id: 2,  role: 'student',          name: '张三',   username: 'zhangsan', major: '计算机科学与技术' },
    admin:     { id: 1,  role: 'admin',             name: '管理员', username: 'admin' },
    counselor: { id: 100, role: 'counselor',        name: '辅导员', username: 'counselor' },
    committee: { id: 101, role: 'class_committee',  name: '班委',   username: 'committee' },
    affairs:   { id: 102, role: 'student_affairs',  name: '学工处', username: 'affairs' },
  };
  const u = users[as] || users.zhangsan;
  req.user = u;
  // 不污染后续请求
  delete req.query.as;
  next();
};
