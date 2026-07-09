const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

// ========== 连接池 ==========
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "135246",
  multipleStatements: true,          // 允许一次执行多条SQL
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ========== 安全初始化（只建库建表，不删数据） ==========
async function initZongceDatabase() {
  const conn = await pool.getConnection();
  try {
    // 读取 init.sql
    const sqlPath = path.join(__dirname, "../services/zongce/db/init.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");

    // 执行 SQL（全部使用 IF NOT EXISTS，已有数据不受影响）
    await conn.query(sql);
    console.log("[DB] lingshu_zongce 数据库初始化完成（已存在的表和数据不受影响）");
  } catch (err) {
    console.error("[DB] lingshu_zongce 初始化失败:", err.message);
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, initZongceDatabase };
