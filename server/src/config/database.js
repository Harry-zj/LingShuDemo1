const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// ========== 连接池 → lingshu_zongce ==========
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "135246",
  database: "lingshu_zongce",          // ★ 直接指定数据库
  multipleStatements: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ========== 初始化：建库 + 建表（全部 IF NOT EXISTS，安全幂等） ==========
async function initDatabase() {
  // 先建库（此时还没选数据库，用不指定 database 的临时连接）
  const tmpPool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "135246",
    multipleStatements: true,
  });
  const tmpConn = await tmpPool.getConnection();
  try {
    await tmpConn.query("CREATE DATABASE IF NOT EXISTS lingshu_zongce CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
  } finally {
    tmpConn.release();
    tmpPool.end();
  }

  // 再建表
  const conn = await pool.getConnection();
  try {
    const sqlPath = path.join(__dirname, "../services/zongce/db/init.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");
    // 去掉 init.sql 里前两行（CREATE DATABASE / USE），因为已经在 pool 里指定了 database
    const tableSql = sql
      .replace(/CREATE DATABASE IF NOT EXISTS[^;]*;\s*/i, "")
      .replace(/USE\s+lingshu_zongce\s*;\s*/i, "");
    await conn.query(tableSql);
    console.log("[DB] lingshu_zongce 初始化完成");
  } catch (err) {
    console.error("[DB] 初始化失败:", err.message);
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, initDatabase };
