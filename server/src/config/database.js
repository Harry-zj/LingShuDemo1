async function initDatabase() {
  console.log("[Mock] 当前为免数据库演示模式，未连接 MySQL。");
}

module.exports = {
  pool: null,
  initDatabase,
};
