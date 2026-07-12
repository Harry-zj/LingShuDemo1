const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { seedDevData } = require("../services/zongce/db/seed");

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
    const sql = fs.readFileSync(sqlPath, "utf-8").replace(/^\uFEFF/, "");
    const tableSql = sql
      .replace(/CREATE DATABASE IF NOT EXISTS[^;]*;\s*/i, "")
      .replace(/USE\s+lingshu_zongce\s*;\s*/i, "");
    await conn.query(tableSql);

    console.log("[DB] 建表完成，开始种子数据...");

    // 迁移：evaluation_results 表结构升级（兼容旧表）
    const migrations = [
      "ALTER TABLE rule_items ADD COLUMN limit_value DECIMAL(5,2) DEFAULT NULL AFTER rule_type",
      "ALTER TABLE rule_items ADD COLUMN scope VARCHAR(50) DEFAULT NULL AFTER limit_value",
      "ALTER TABLE rule_items ADD COLUMN strategy VARCHAR(50) DEFAULT NULL AFTER scope",
      "ALTER TABLE rule_sources ADD COLUMN file_hash CHAR(64) DEFAULT NULL",
      "ALTER TABLE rule_sources ADD COLUMN is_frozen TINYINT(1) DEFAULT 0",
      // ★ fact_rule_matches 补列（V2 匹配管线需要）
      "ALTER TABLE fact_rule_matches ADD COLUMN is_current TINYINT(1) DEFAULT 1 AFTER review_status",
      "ALTER TABLE fact_rule_matches ADD COLUMN is_selected TINYINT(1) DEFAULT 1 AFTER is_current",
      "ALTER TABLE fact_rule_matches ADD COLUMN preview_data JSON DEFAULT NULL AFTER is_selected",
    ];
    // rule_set_documents 列名迁移（兼容旧表 source_document_id）
    try {
      await conn.execute("ALTER TABLE rule_set_documents CHANGE source_document_id rule_source_id INT NOT NULL");
    } catch (e) {
      if (e.errno !== 1054 && e.errno !== 1060) console.warn("[DB] 迁移 rule_set_documents:", e.message);
    }
    for (const s of migrations) {
      try { await conn.execute(s); } catch (e) {
        if (e.errno !== 1060) console.warn("[DB] 迁移:", e.message);
      }
    }

    // 种子数据（INSERT IGNORE 幂等安全，仅含系统配置）
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