const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { seedDevData } = require("../services/zongce/db/seed");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "20060918fca",
  database: "lingshu_zongce",
  charset: "utf8mb4",
  multipleStatements: true,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

async function initDatabase() {
  // 建库
  const tmpPool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "20060918fca",
    charset: "utf8mb4",
    multipleStatements: true,
  });
  const tmpConn = await tmpPool.getConnection();
  try {
    await tmpConn.query("CREATE DATABASE IF NOT EXISTS lingshu_zongce CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
  } finally {
    tmpConn.release();
    tmpPool.end();
  }

  // 建表
  const conn = await pool.getConnection();
  try {
    const sqlPath = path.join(__dirname, "../services/zongce/db/init.sql");
    const sql = fs.readFileSync(sqlPath, "utf-8");
    const tableSql = sql
      .replace(/CREATE DATABASE IF NOT EXISTS[^;]*;\s*/i, "")
      .replace(/USE\s+lingshu_zongce\s*;\s*/i, "");
    await conn.query(tableSql);

    console.log("[DB] 建表完成，开始种子数据...");

    // 迁移：evaluation_results 表结构升级（兼容旧表）
    const migrations = [
      "ALTER TABLE evaluation_results ADD COLUMN batch_id INT DEFAULT NULL AFTER user_id",
      "ALTER TABLE evaluation_results DROP INDEX uk_user",
      "ALTER TABLE evaluation_results ADD UNIQUE KEY uk_user_batch (user_id, batch_id)",
    ];
    for (const sql of migrations) {
      try { await conn.query(sql); } catch (_) { /* 列/索引已存在则跳过 */ }
    }

    // 种子数据（INSERT IGNORE 幂等安全，只含张三测试用户）
    await seedDevData(conn);

    console.log("[DB] lingshu_zongce 初始化完成");
  } catch (err) {
    console.error("[DB] 初始化失败:", err.message);
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, initDatabase };