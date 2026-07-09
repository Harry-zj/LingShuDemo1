// 数据库连接已按当前需求补全阶段临时禁用。
// 后续需要接入 MySQL 时，可恢复原 mysql2/promise 连接池，并将 mock store 替换为数据库 service/DAO。
const pool = {
  async execute() {
    throw new Error('数据库当前已禁用，请使用 server/src/mock/assessmentStore.js 中的内存数据');
  },
};

async function initDatabase() {
  console.log('[DB] 当前为免数据库演示模式，跳过数据库连接与建表初始化');
}

module.exports = { pool, initDatabase };
