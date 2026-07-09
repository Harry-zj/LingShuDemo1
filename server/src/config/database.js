const mysql = require("mysql2/promise");
require("dotenv").config();
const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "123456",
  database: process.env.DB_NAME || "lingshu",
  charset: "utf8mb4",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
async function initDatabase() {
  const conn = await pool.getConnection();
  try {
    await conn.execute("CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(50) NOT NULL UNIQUE, password VARCHAR(255) NOT NULL, role ENUM(\"student\",\"class_leader\",\"teacher\") NOT NULL DEFAULT \"student\", real_name VARCHAR(50) DEFAULT \"\", class_id INT DEFAULT NULL, phone VARCHAR(20) DEFAULT \"\", avatar VARCHAR(255) DEFAULT \"\", created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    await conn.execute("CREATE TABLE IF NOT EXISTS classes (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, major VARCHAR(100) DEFAULT \"\", grade VARCHAR(20) DEFAULT \"\", teacher_id INT DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    await conn.execute("CREATE TABLE IF NOT EXISTS batches (id INT AUTO_INCREMENT PRIMARY KEY, title VARCHAR(200) NOT NULL, description TEXT, start_time DATETIME NOT NULL, end_time DATETIME NOT NULL, status ENUM(\"draft\",\"published\",\"closed\",\"archived\") DEFAULT \"draft\", requirements TEXT, created_by INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    await conn.execute("CREATE TABLE IF NOT EXISTS materials (id INT AUTO_INCREMENT PRIMARY KEY, batch_id INT NOT NULL, student_id INT NOT NULL, title VARCHAR(200) NOT NULL, category VARCHAR(100) DEFAULT \"\", status ENUM(\"draft\",\"pending_class_leader\",\"returned_by_class_leader\",\"pending_teacher\",\"returned_by_teacher\",\"approved\",\"rejected\") DEFAULT \"draft\", score DECIMAL(5,2) DEFAULT 0.00, rule_match JSON, ai_confidence DECIMAL(5,4) DEFAULT NULL, submit_time DATETIME DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    await conn.execute("CREATE TABLE IF NOT EXISTS attachments (id INT AUTO_INCREMENT PRIMARY KEY, material_id INT NOT NULL, file_name VARCHAR(255) NOT NULL, file_path VARCHAR(500) NOT NULL, file_type VARCHAR(50) DEFAULT \"\", file_size INT DEFAULT 0, ai_label VARCHAR(100) DEFAULT \"\", created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    await conn.execute("CREATE TABLE IF NOT EXISTS review_records (id INT AUTO_INCREMENT PRIMARY KEY, material_id INT NOT NULL, reviewer_id INT NOT NULL, reviewer_role ENUM(\"class_leader\",\"teacher\") NOT NULL, action ENUM(\"approve\",\"return\",\"reject\") NOT NULL, comment TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    await conn.execute("CREATE TABLE IF NOT EXISTS evaluation_results (id INT AUTO_INCREMENT PRIMARY KEY, student_id INT NOT NULL, batch_id INT NOT NULL, total_score DECIMAL(6,2) DEFAULT 0.00, dimension_scores JSON, report_content TEXT, advice JSON, class_rank INT DEFAULT NULL, class_size INT DEFAULT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    await conn.execute("CREATE TABLE IF NOT EXISTS notifications (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, title VARCHAR(200) NOT NULL, content TEXT, is_read TINYINT(1) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    await conn.execute("CREATE TABLE IF NOT EXISTS operation_logs (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, action VARCHAR(100) NOT NULL, target_type VARCHAR(50) DEFAULT \"\", target_id INT DEFAULT NULL, detail TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
    console.log("[DB] 数据库表初始化完成");
  } catch (err) {
    console.error("[DB] 初始化失败:", err.message);
  } finally {
    conn.release();
  }
}
module.exports = { pool, initDatabase };
