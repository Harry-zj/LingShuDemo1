const mysql = require("mysql2/promise");
const fs = require("fs");
const path = require("path");
require("dotenv").config();

const { seedDevData } = require("../services/zongce/db/seed");
const { migrateModule3 } = require("../services/module3/migrate");

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "Zj317317",
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
    password: process.env.DB_PASSWORD || "Zj317317",
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

    // 报告缓存表（跨设备同步 AI 内容 + 用户数据）
    await conn.query(`CREATE TABLE IF NOT EXISTS report_cache (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      batch_id INT NOT NULL,
      report_data JSON,
      dim_profiles JSON,
      goals JSON,
      plan_done JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uk_user_batch (user_id, batch_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

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

    // 模块三：先兼容升级旧数据库，再执行使用新字段的幂等种子数据。
    await migrateModule3(conn);

    // ★ 修复：init.sql 末尾的 ALTER TABLE 移到此处用 try/catch 保护（原位置会因重复执行崩溃）
    const initMigrations = [
      "ALTER TABLE assessment_form_items ADD INDEX idx_items_form_id (form_id)",
      "ALTER TABLE assessment_review_records ADD INDEX idx_records_form_id (form_id)",
      "ALTER TABLE assessment_item_reviews  ADD INDEX idx_item_reviews_form_id (form_id)",
      "ALTER TABLE assessment_objections    ADD INDEX idx_objections_form_id (form_id)",
    ];
    for (const s of initMigrations) {
      try { await conn.execute(s); } catch (e) {
        if (e.errno !== 1061 && e.errno !== 1091) console.warn("[DB] init迁移:", e.message);
      }
    }


    // ★ V4 迁移：rule_sets → assessment_batches 关联
    try { await conn.execute("ALTER TABLE rule_sets ADD COLUMN batch_id INT DEFAULT NULL AFTER user_id"); }
    catch (e) { if (e.errno !== 1060) console.warn("[DB] V4迁移 rule_sets.batch_id:", e.message); }
    try { await conn.execute("ALTER TABLE rule_sets ADD INDEX idx_rule_sets_batch (batch_id)"); }
    catch (e) { if (e.errno !== 1061) console.warn("[DB] V4迁移 idx_rule_sets_batch:", e.message); }
    try { await conn.execute("ALTER TABLE smart_fill_data ADD COLUMN batch_id INT DEFAULT NULL AFTER rule_set_id"); }
    catch (e) { if (e.errno !== 1060) console.warn("[DB] V4迁移 smart_fill_data.batch_id:", e.message); }
    try { await conn.execute("ALTER TABLE smart_fill_data ADD INDEX idx_sfd_batch (batch_id)"); }
    catch (e) { if (e.errno !== 1061) console.warn("[DB] V4迁移 idx_sfd_batch:", e.message); }

    // ★ V5 迁移：scoring_rules 直接关联批次
    try { await conn.execute("ALTER TABLE scoring_rules ADD COLUMN batch_id INT DEFAULT NULL AFTER rule_set_id"); }
    catch (e) { if (e.errno !== 1060) console.warn("[DB] V5迁移 scoring_rules.batch_id:", e.message); }
    try { await conn.execute("ALTER TABLE scoring_rules ADD INDEX idx_sr_batch (batch_id)"); }
    catch (e) { if (e.errno !== 1061) console.warn("[DB] V5迁移 idx_sr_batch:", e.message); }

    // ★ V6 迁移：rule_sources 直接关联批次
    try { await conn.execute("ALTER TABLE rule_sources ADD COLUMN batch_id INT DEFAULT NULL AFTER user_id"); }
    catch (e) { if (e.errno !== 1060) console.warn("[DB] V6迁移 rule_sources.batch_id:", e.message); }
    try { await conn.execute("ALTER TABLE rule_sources ADD INDEX idx_rsrc_batch (batch_id)"); }
    catch (e) { if (e.errno !== 1061) console.warn("[DB] V6迁移 idx_rsrc_batch:", e.message); }

    // ★ V7 迁移：扩大 scoring_rules 字段容量防止 AI 输出超长
    try { await conn.execute("ALTER TABLE scoring_rules MODIFY score_level VARCHAR(100)"); }
    catch (e) { console.warn("[DB] V7迁移 score_level:", e.message); }
    try { await conn.execute("ALTER TABLE scoring_rules MODIFY item_name VARCHAR(100)"); }
    catch (e) { console.warn("[DB] V7迁移 item_name:", e.message); }

    // ★ V8 迁移：batch_fill_tasks 支持 OSS URL 和软删除
    try { await conn.execute("ALTER TABLE batch_fill_tasks ADD COLUMN is_deleted TINYINT(1) DEFAULT 0"); }
    catch (e) { if (e.errno !== 1060) console.warn("[DB] V8迁移 is_deleted:", e.message); }
    try { await conn.execute("ALTER TABLE batch_fill_tasks ADD COLUMN deleted_at TIMESTAMP NULL"); }
    catch (e) { if (e.errno !== 1060) console.warn("[DB] V8迁移 deleted_at:", e.message); }
    try { await conn.execute("ALTER TABLE batch_fill_tasks ADD COLUMN result_files JSON DEFAULT NULL"); }
    catch (e) { if (e.errno !== 1060) console.warn("[DB] V8迁移 result_files:", e.message); }

    // ★ V9 迁移：chat_fill_sessions 改造 + chat_fill_messages 建表
    try { await conn.execute("ALTER TABLE chat_fill_sessions ADD COLUMN template_name VARCHAR(255) DEFAULT '' AFTER template_id"); }
    catch (e) { if (e.errno !== 1060) console.warn("[DB] V9迁移 template_name:", e.message); }
    try { await conn.execute("ALTER TABLE chat_fill_sessions ADD COLUMN template_oss_url VARCHAR(500) DEFAULT '' AFTER template_name"); }
    catch (e) { if (e.errno !== 1060) console.warn("[DB] V9迁移 template_oss_url:", e.message); }
    try { await conn.execute("ALTER TABLE chat_fill_sessions ADD COLUMN result_oss_url VARCHAR(500) DEFAULT '' AFTER fields_json"); }
    catch (e) { if (e.errno !== 1060) console.warn("[DB] V9迁移 result_oss_url:", e.message); }
    try { await conn.execute("ALTER TABLE chat_fill_sessions ADD COLUMN is_deleted TINYINT(1) DEFAULT 0"); }
    catch (e) { if (e.errno !== 1060) console.warn("[DB] V9迁移 chat_fill_sessions.is_deleted:", e.message); }
    try { await conn.execute(`CREATE TABLE IF NOT EXISTS chat_fill_messages (
      id INT AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL,
      field_key VARCHAR(100) NOT NULL,
      role ENUM('user','assistant') NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_cfmsg_session_field (session_id, field_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`); }
    catch (e) { console.warn("[DB] V9迁移 chat_fill_messages:", e.message); }

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