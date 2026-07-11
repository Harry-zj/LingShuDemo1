-- ============================================================
-- 灵枢 · 综测核心引擎 · 数据库初始化脚本
-- 使用：mysql -u root -p < server/db/init.sql
-- 说明：app启动时也会自动执行此脚本建库建表
-- ============================================================

CREATE DATABASE IF NOT EXISTS lingshu_zongce CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lingshu_zongce;

-- ============================================================
-- ============================================================
-- 一、用户表（扩展版：支持多角色 + 学生信息字段）
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('student','class_leader','teacher','class_committee','counselor','student_affairs','admin') NOT NULL DEFAULT 'student',
  real_name VARCHAR(50) DEFAULT '',
  student_no VARCHAR(20) DEFAULT NULL,
  class_id INT DEFAULT NULL,
  class_name VARCHAR(100) DEFAULT '',
  college VARCHAR(100) DEFAULT '',
  major VARCHAR(100) DEFAULT '',
  grade VARCHAR(20) DEFAULT '',
  phone VARCHAR(20) DEFAULT '',
  avatar VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 二、规则来源表
-- ============================================================
CREATE TABLE IF NOT EXISTS rule_sources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  source_type ENUM('file','text') NOT NULL,
  file_name VARCHAR(255) DEFAULT '',
  file_path VARCHAR(500) DEFAULT '',
  original_text LONGTEXT,
  status ENUM('pending','parsed') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 三、规则项表（★核心★ scoring/limit/conflict）
-- ============================================================
CREATE TABLE IF NOT EXISTS rule_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  source_id INT DEFAULT NULL,
  category VARCHAR(50) DEFAULT NULL,
  description TEXT NOT NULL,
  level VARCHAR(20) DEFAULT NULL,
  score DECIMAL(5,2) DEFAULT NULL,
  rule_type ENUM('scoring','limit','conflict') NOT NULL DEFAULT 'scoring',
  limit_value DECIMAL(5,2) DEFAULT NULL,
  scope VARCHAR(50) DEFAULT NULL,
  strategy VARCHAR(50) DEFAULT NULL,
  max_times INT DEFAULT 1,
  conflict_group VARCHAR(100) DEFAULT NULL,
  proof_required JSON DEFAULT NULL,
  status ENUM('pending_confirm','confirmed') DEFAULT 'pending_confirm',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 四、材料表
-- ============================================================
CREATE TABLE IF NOT EXISTS materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(200) DEFAULT '',
  category VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 五、附件表
-- ============================================================
CREATE TABLE IF NOT EXISTS attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_size INT DEFAULT 0,
  file_type VARCHAR(50) DEFAULT '',
  ai_label VARCHAR(100) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 六、材料识别表（★核心★）
-- ============================================================
CREATE TABLE IF NOT EXISTS material_recognitions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_id INT NOT NULL,
  category VARCHAR(50) DEFAULT '',
  explanation TEXT,
  matched_rule_ids JSON DEFAULT NULL,
  confidence DECIMAL(5,4) DEFAULT NULL,
  confirm_status ENUM('pending','confirmed','dismissed') DEFAULT 'pending',
  raw_ai_response JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 七、评定结果表（★ 通用 FillData.evaluation 格式 ★）
-- ============================================================
-- dimension_scores 采用 dimensions 数组，兼容任何综测体系
-- 结构: { dimensions: [{ id, name, weight, score, raw_score, max_score, detail_text, items: [...] }] }
-- 个性评定结果表（每个用户每批次一条记录，支持多学年历史）
-- dimension_scores JSON: { aScores:{}, bScores:{}, scores:{}, classAvg:{}, rank, totalStudents, majorRank, majorTotal }
CREATE TABLE IF NOT EXISTS evaluation_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  batch_id INT DEFAULT NULL,
  total_score DECIMAL(6,2) DEFAULT 0.00,
  grade VARCHAR(10) DEFAULT NULL,
  formula TEXT DEFAULT NULL,
  dimension_scores JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_batch (user_id, batch_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 七之二、个性评定配置表（权重 & 等级阈值，支持管理员动态调整）
-- ============================================================
CREATE TABLE IF NOT EXISTS evaluation_config (
  id INT AUTO_INCREMENT PRIMARY KEY,
  config_key VARCHAR(50) NOT NULL UNIQUE,
  config_value JSON DEFAULT NULL,
  description VARCHAR(200) DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 八、填表模板表
-- ============================================================
CREATE TABLE IF NOT EXISTS fill_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  template_type VARCHAR(20) DEFAULT 'docx',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 九、模板字段映射表（★ 核心 ★ 占位符 → FillData 数据路径）
-- ============================================================
DROP TABLE IF EXISTS fill_fields;
CREATE TABLE IF NOT EXISTS fill_template_mappings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_id INT NOT NULL,
  placeholder VARCHAR(100) NOT NULL,
  field_label VARCHAR(100) DEFAULT '',
  data_path VARCHAR(300) NOT NULL,
  field_type ENUM('text','number','loop','table') DEFAULT 'text',
  format VARCHAR(50) DEFAULT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 十、AI任务追踪表
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  target_type VARCHAR(50) NOT NULL,
  target_id INT NOT NULL,
  status ENUM('pending','processing','completed','failed') DEFAULT 'pending',
  result JSON DEFAULT NULL,
  error_msg TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 十一、填表结果表
-- ============================================================
CREATE TABLE IF NOT EXISTS fill_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  template_id INT NOT NULL,
  result_path VARCHAR(500) NOT NULL,
  original_name VARCHAR(300) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- 十二、评估批次表
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  start_time DATETIME DEFAULT NULL,
  end_time DATETIME DEFAULT NULL,
  requirements TEXT,
  status VARCHAR(30) DEFAULT 'draft',
  created_by INT NOT NULL,
  creator_name VARCHAR(50) DEFAULT '',
  options JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 十三、评估表单表（★ 综测表核心数据）
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_forms (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL,
  batch_title VARCHAR(200) DEFAULT '',
  student_id INT NOT NULL,
  student_name VARCHAR(50) DEFAULT '',
  student_no VARCHAR(20) DEFAULT '',
  college VARCHAR(100) DEFAULT '',
  major VARCHAR(100) DEFAULT '',
  grade VARCHAR(20) DEFAULT '',
  class_id INT DEFAULT NULL,
  class_name VARCHAR(100) DEFAULT '',
  from_smart_fill TINYINT(1) DEFAULT 1,
  status VARCHAR(50) DEFAULT 'smart_ready',
  level VARCHAR(10) DEFAULT '',
  manual_level VARCHAR(10) DEFAULT '',
  scores JSON NOT NULL,
  personal_summary TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 十四、评估表加分项明细
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_form_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  form_id INT NOT NULL,
  section VARCHAR(10) NOT NULL,
  sub_key VARCHAR(20) NOT NULL DEFAULT '',
  title VARCHAR(200) DEFAULT '',
  reason TEXT,
  score DECIMAL(5,2) DEFAULT 0,
  evidence_ids JSON DEFAULT NULL,
  editable TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 十五、评估审核记录表
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_review_records (
  id INT AUTO_INCREMENT PRIMARY KEY,
  form_id INT NOT NULL,
  reviewer_role VARCHAR(30) DEFAULT '',
  reviewer_name VARCHAR(50) DEFAULT '',
  action VARCHAR(20) DEFAULT '',
  action_label VARCHAR(20) DEFAULT '',
  level VARCHAR(10) DEFAULT '',
  comment TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- 十六、系统设置表
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_settings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(50) NOT NULL UNIQUE,
  setting_value JSON DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 十七、批量填表任务表
-- ============================================================
CREATE TABLE IF NOT EXISTS batch_fill_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  excel_path VARCHAR(500) NOT NULL,
  template_path VARCHAR(500) NOT NULL,
  excel_name VARCHAR(255) DEFAULT '',
  template_name VARCHAR(255) DEFAULT '',
  total_rows INT DEFAULT 0,
  mappings JSON DEFAULT NULL,
  status VARCHAR(30) DEFAULT 'uploaded',
  result_path VARCHAR(500) DEFAULT '',
  success_count INT DEFAULT 0,
  fail_count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 十八、对话填表会话表
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_fill_sessions (
  id VARCHAR(64) PRIMARY KEY,
  user_id INT NOT NULL,
  template_id INT NOT NULL,
  fields_json JSON DEFAULT NULL,
  status VARCHAR(30) DEFAULT 'analyzed',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
