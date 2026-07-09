const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "135246",
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
    password: process.env.DB_PASSWORD || "135246",
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

    // 安全迁移：给已存在的表补列（MySQL 不支持 IF NOT EXISTS，用 try/catch）
    const migrations = [
      "ALTER TABLE rule_items ADD COLUMN limit_value DECIMAL(5,2) DEFAULT NULL AFTER rule_type",
      "ALTER TABLE rule_items ADD COLUMN scope VARCHAR(50) DEFAULT NULL AFTER limit_value",
      "ALTER TABLE rule_items ADD COLUMN strategy VARCHAR(50) DEFAULT NULL AFTER scope",
    ];
    for (const s of migrations) {
      try { await conn.execute(s); } catch (e) {
        if (e.errno !== 1060) console.warn("[DB] 迁移:", e.message);
      }
    }

    // 开发环境：确保 dev 用户存在
    try {
      const bcrypt = require("bcryptjs");
      const pwd = await bcrypt.hash("123456", 10);
      await conn.execute(
        "INSERT IGNORE INTO users (id, username, password, role, real_name) VALUES (1, 'dev', ?, 'student', '开发测试')",
        [pwd]
      );
    } catch (e) { /* 忽略 */ }

    console.log("[DB] lingshu_zongce 初始化完成");
  } catch (err) {
    console.error("[DB] 初始化失败:", err.message);
    throw err;
  } finally {
    conn.release();
  }
}

module.exports = { pool, initDatabase };
