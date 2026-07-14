-- ============================================================
-- 灵枢 · 综测核心引擎 · 数据库初始化脚本
-- 使用：mysql -u root -p < server/db/init.sql
-- 说明：app启动时也会自动执行此脚本建库建表
-- ============================================================

CREATE DATABASE IF NOT EXISTS lingshu_zongce CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lingshu_zongce;

-- ============================================================
-- 一、用户表（扩展版：支持多角色 + 学生信息字段）
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('student','class_leader','teacher','class_committee','counselor','student_affairs','admin') NOT NULL DEFAULT 'student',
  is_assessment_member TINYINT(1) NOT NULL DEFAULT 0,
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
  file_hash CHAR(64) DEFAULT NULL,
  is_frozen TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 三、简化的计分规则表（V3 替代 V1/V2 多表体系）
-- ============================================================
CREATE TABLE IF NOT EXISTS scoring_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_set_id INT NOT NULL,
  user_id INT NOT NULL,
  section VARCHAR(10) DEFAULT 'F3',
  item_key VARCHAR(10) NOT NULL,
  item_name VARCHAR(50),
  score_level VARCHAR(20),
  score_rank VARCHAR(50),
  score INT NOT NULL DEFAULT 0,
  keywords TEXT,
  description TEXT,
  max_score INT DEFAULT NULL,
  dedup_group VARCHAR(50) DEFAULT NULL,
  status ENUM('active','inactive') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_sr_rule_set (rule_set_id),
  INDEX idx_sr_user (user_id),
  INDEX idx_sr_item_key (item_key),
  INDEX idx_sr_level_rank (score_level, score_rank)
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
  batch_id INT DEFAULT NULL,
  template_id INT NOT NULL,
  result_path VARCHAR(500) NOT NULL,
  original_name VARCHAR(300) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_fill_results_user_batch (user_id, batch_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;


-- ============================================================
-- 十二、评估批次表
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_batches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  school_year VARCHAR(20) NOT NULL DEFAULT '',
  title VARCHAR(200) NOT NULL,
  college VARCHAR(100) NOT NULL DEFAULT '',
  grade VARCHAR(20) NOT NULL DEFAULT '',
  description TEXT,
  start_time DATETIME DEFAULT NULL,
  end_time DATETIME DEFAULT NULL,
  requirements TEXT,
  status VARCHAR(30) DEFAULT 'draft',
  created_by INT NOT NULL,
  creator_name VARCHAR(50) DEFAULT '',
  options JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_batch_scope (college, grade, school_year)
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
  is_demo TINYINT(1) NOT NULL DEFAULT 0,
  status VARCHAR(50) DEFAULT 'smart_ready',
  level VARCHAR(10) DEFAULT '',
  manual_level VARCHAR(10) DEFAULT '',
  scores JSON NOT NULL,
  personal_summary TEXT,
  result_released_at DATETIME DEFAULT NULL,
  pre_objection_status VARCHAR(50) NOT NULL DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_student_batch (student_id, batch_id)
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
-- 十四点五、智能填表数据缓存表
-- ============================================================
CREATE TABLE IF NOT EXISTS smart_fill_data (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  rule_set_id INT NOT NULL,
  section VARCHAR(10) NOT NULL COMMENT 'F1/F2/F3',
  item_key VARCHAR(20) NOT NULL COMMENT 'A1/B1/COURSE等',
  score DECIMAL(5,2) DEFAULT 0,
  description TEXT COMMENT '理由/评语',
  extra_data JSON DEFAULT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_rule_item (user_id, rule_set_id, section, item_key)
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
-- 十六之二、模块三班级与评价任务相关表
-- ============================================================
CREATE TABLE IF NOT EXISTS assessment_colleges (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_assessment_college_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assessment_majors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  college_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_assessment_major (college_id, name),
  KEY idx_assessment_major_college (college_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assessment_classes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  college VARCHAR(100) NOT NULL DEFAULT '',
  major VARCHAR(100) NOT NULL DEFAULT '',
  grade VARCHAR(20) NOT NULL DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_assessment_class_scope (college, major, grade, name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS counselor_scopes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  counselor_id INT NOT NULL,
  college VARCHAR(100) NOT NULL DEFAULT '',
  grade VARCHAR(20) NOT NULL DEFAULT '',
  class_ids JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_counselor_scope (counselor_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assessment_review_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL,
  target_class_id INT NOT NULL,
  target_class_name VARCHAR(100) NOT NULL DEFAULT '',
  reviewer_class_id INT NOT NULL,
  reviewer_class_name VARCHAR(100) NOT NULL DEFAULT '',
  created_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_batch_target_class (batch_id, target_class_id),
  KEY idx_assignment_batch (batch_id),
  KEY idx_assignment_reviewer_class (reviewer_class_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assessment_review_assignment_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  assignment_id INT NOT NULL,
  reviewer_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_assignment_reviewer (assignment_id, reviewer_id),
  KEY idx_assignment_member_reviewer (reviewer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assessment_batch_members (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL,
  student_id INT NOT NULL,
  assigned_by INT DEFAULT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  removed_at DATETIME DEFAULT NULL,
  UNIQUE KEY uk_batch_student_member (batch_id, student_id),
  KEY idx_batch_member_batch_status (batch_id, status),
  KEY idx_batch_member_student (student_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assessment_review_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL,
  form_id INT NOT NULL,
  reviewer_id INT NOT NULL,
  reviewer_name VARCHAR(50) DEFAULT '',
  reviewer_no VARCHAR(20) DEFAULT '',
  reviewer_class_id INT DEFAULT NULL,
  reviewer_class_name VARCHAR(100) DEFAULT '',
  target_class_name VARCHAR(100) DEFAULT '',
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  stage VARCHAR(30) NOT NULL DEFAULT 'initial',
  action VARCHAR(20) DEFAULT '',
  comment TEXT,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME DEFAULT NULL,
  KEY idx_task_batch_reviewer (batch_id, reviewer_id),
  KEY idx_task_form (form_id),
  KEY idx_task_status (status),
  KEY idx_task_batch_status_stage (batch_id, status, stage)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assessment_item_reviews (
  id INT AUTO_INCREMENT PRIMARY KEY,
  form_id INT NOT NULL,
  item_id INT NOT NULL,
  reviewer_id INT NOT NULL,
  reviewer_role VARCHAR(30) NOT NULL DEFAULT '',
  stage VARCHAR(30) NOT NULL DEFAULT 'initial',
  action VARCHAR(20) NOT NULL DEFAULT 'approve',
  reason TEXT,
  reviewed_score DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_item_review_stage (form_id, item_id, reviewer_id, reviewer_role, stage),
  KEY idx_item_review_form (form_id),
  KEY idx_item_review_item (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assessment_objections (
  id INT AUTO_INCREMENT PRIMARY KEY,
  batch_id INT NOT NULL,
  form_id INT NOT NULL,
  item_id INT NOT NULL,
  student_id INT NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  original_reviewer_id INT NOT NULL,
  resolution TEXT,
  resolved_by INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  resolved_at DATETIME DEFAULT NULL,
  UNIQUE KEY uk_form_item_objection (form_id, item_id, student_id),
  KEY idx_objection_batch_status (batch_id, status),
  KEY idx_objection_form_status (form_id, status),
  KEY idx_objection_reviewer (original_reviewer_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS assessment_operation_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  operator_id INT DEFAULT NULL,
  operator_name VARCHAR(50) DEFAULT '',
  operator_role VARCHAR(30) DEFAULT '',
  action VARCHAR(100) DEFAULT '',
  target VARCHAR(200) DEFAULT '',
  detail TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  KEY idx_operation_created_at (created_at),
  KEY idx_operation_operator (operator_id)
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
  result_files JSON DEFAULT NULL,
  success_count INT DEFAULT 0,
  fail_count INT DEFAULT 0,
  is_deleted TINYINT(1) DEFAULT 0,
  deleted_at TIMESTAMP NULL,
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
  template_name VARCHAR(255) DEFAULT '',
  template_oss_url VARCHAR(500) DEFAULT '',
  fields_json JSON DEFAULT NULL,
  result_oss_url VARCHAR(500) DEFAULT '',
  status VARCHAR(30) DEFAULT 'analyzed',
  is_deleted TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 对话填表消息记录
CREATE TABLE IF NOT EXISTS chat_fill_messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  field_key VARCHAR(100) NOT NULL,
  role ENUM('user','assistant') NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_cfmsg_session_field (session_id, field_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- V2 规则系统（与 V1 表共存，增量升级）
-- ============================================================

CREATE TABLE IF NOT EXISTS rule_sets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  batch_id INT DEFAULT NULL,
  version_label VARCHAR(100) DEFAULT '',
  cloned_from_id INT DEFAULT NULL,
  status ENUM('draft','published','archived','parse_structure_failed') DEFAULT 'draft',
  published_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rule_set_documents (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_set_id INT NOT NULL,
  rule_source_id INT NOT NULL,
  document_role ENUM('primary','supplement','amendment','appendix','interpretation') DEFAULT 'primary',
  priority INT DEFAULT 0,
  merge_mode ENUM('append','override','replace','clarify') DEFAULT 'append',
  scope_config JSON DEFAULT NULL,
  parse_run_id INT DEFAULT NULL,
  UNIQUE KEY uk_rsd (rule_set_id, rule_source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS document_parse_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_source_id INT NOT NULL,
  parser_version VARCHAR(20) DEFAULT 'v1',
  model_name VARCHAR(50) DEFAULT '',
  prompt_version VARCHAR(20) DEFAULT '',
  input_hash CHAR(64) DEFAULT '',
  raw_ai_response LONGTEXT,
  status ENUM('running','completed','failed','parse_structure_failed') DEFAULT 'running',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS doc_blocks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_source_id INT NOT NULL,
  parse_run_id INT NOT NULL,
  block_type ENUM('heading','paragraph','table','list','note','formula','image'),
  title VARCHAR(500) DEFAULT '',
  content LONGTEXT,
  structured_content JSON DEFAULT NULL,
  source_location VARCHAR(200) DEFAULT '',
  parent_id INT DEFAULT NULL,
  order_index INT DEFAULT 0,
  is_frozen TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS doc_block_relations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  source_block_id INT NOT NULL,
  target_block_id INT NOT NULL,
  relation_type ENUM('annotates','describes','continues','belongs_to') NOT NULL,
  confidence DECIMAL(5,4) DEFAULT NULL,
  UNIQUE KEY uk_dbr (source_block_id, target_block_id, relation_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS material_analysis_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_id INT NOT NULL,
  model_name VARCHAR(50) DEFAULT '',
  prompt_version VARCHAR(20) DEFAULT '',
  parser_version VARCHAR(20) DEFAULT 'v1',
  input_hash CHAR(64) NOT NULL,
  output_hash CHAR(64) DEFAULT '',
  raw_ai_response LONGTEXT,
  status ENUM('running','completed','failed','needs_review') DEFAULT 'running',
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS extracted_facts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  analysis_run_id INT NOT NULL,
  fact_key VARCHAR(100) NOT NULL,
  fact_type ENUM('award','position','activity','certificate','score','duration','count','text','other'),
  fact_data JSON NOT NULL,
  semantic_hash CHAR(64) DEFAULT '',
  confidence DECIMAL(5,4) DEFAULT NULL,
  status ENUM('active','superseded') DEFAULT 'active',
  UNIQUE KEY uk_ef (analysis_run_id, fact_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS extracted_fact_sources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  extracted_fact_id INT NOT NULL,
  attachment_id INT NOT NULL,
  source_locator VARCHAR(200) DEFAULT '',
  raw_excerpt TEXT,
  confidence DECIMAL(5,4) DEFAULT NULL,
  UNIQUE KEY uk_efs (extracted_fact_id, attachment_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rule_match_runs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_set_id INT NOT NULL,
  analysis_run_id INT NOT NULL,
  model_name VARCHAR(50) DEFAULT '',
  prompt_version VARCHAR(20) DEFAULT '',
  input_hash CHAR(64) DEFAULT '',
  raw_ai_response LONGTEXT,
  status ENUM('running','completed','failed','needs_review') DEFAULT 'running',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS fact_rule_matches (
  id INT AUTO_INCREMENT PRIMARY KEY,
  match_run_id INT NOT NULL,
  extracted_fact_id INT NOT NULL,
  executable_rule_id INT NOT NULL,
  match_condition ENUM('pass','fail','uncertain') NOT NULL,
  confidence DECIMAL(5,4) DEFAULT NULL,
  reason TEXT,
  review_status ENUM('pending','confirmed','rejected') DEFAULT 'pending',
  is_current TINYINT(1) DEFAULT 1,
  is_selected TINYINT(1) DEFAULT 1,
  preview_data JSON DEFAULT NULL,
  UNIQUE KEY uk_frm (match_run_id, extracted_fact_id, executable_rule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS calculation_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_set_id INT NOT NULL,
  student_id INT NOT NULL,
  requested_by INT NOT NULL,
  current_stage VARCHAR(50) DEFAULT NULL,
  checkpoint JSON DEFAULT NULL,
  engine_version VARCHAR(20) DEFAULT 'v2.0',
  input_snapshot_hash CHAR(64) DEFAULT '',
  status ENUM('pending','running','waiting_review','resuming','completed','failed','cancelled') DEFAULT 'pending',
  total_score DECIMAL(8,2) DEFAULT NULL,
  outcome_status VARCHAR(50) DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS calculation_task_inputs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  calculation_task_id INT NOT NULL,
  material_id INT NOT NULL,
  analysis_run_id INT NOT NULL,
  match_run_id INT NOT NULL,
  input_hash CHAR(64) DEFAULT '',
  UNIQUE KEY uk_cti (calculation_task_id, material_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS calculation_rule_applications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  calculation_task_id INT NOT NULL,
  executable_rule_id INT NOT NULL,
  application_scope ENUM('per_fact','per_material','per_group','per_indicator','global') NOT NULL,
  fact_id INT DEFAULT NULL,
  material_id INT DEFAULT NULL,
  group_key VARCHAR(200) DEFAULT NULL,
  indicator_id INT DEFAULT NULL,
  application_key CHAR(64) NOT NULL,
  status ENUM('pending','executing','applied','skipped','blocked','failed') DEFAULT 'pending',
  UNIQUE KEY uk_cra (calculation_task_id, application_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS calculation_rule_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  calculation_task_id INT NOT NULL,
  rule_application_id INT NOT NULL,
  execution_key CHAR(64) NOT NULL,
  exec_rule_id INT NOT NULL,
  indicator_id INT DEFAULT NULL,
  material_id INT DEFAULT NULL,
  fact_id VARCHAR(50) DEFAULT '',
  group_key VARCHAR(100) DEFAULT '',
  matched BOOLEAN DEFAULT FALSE,
  executed BOOLEAN DEFAULT FALSE,
  score_before DECIMAL(12,4) DEFAULT NULL,
  score_change DECIMAL(12,4) DEFAULT NULL,
  score_after DECIMAL(12,4) DEFAULT NULL,
  input_snapshot JSON DEFAULT NULL,
  output_snapshot JSON DEFAULT NULL,
  exec_status ENUM('applied','skipped','blocked','failed','pending_manual') DEFAULT 'applied',
  attempt_no INT DEFAULT 1,
  UNIQUE KEY uk_crr (calculation_task_id, execution_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS calculation_rule_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_result_id INT NOT NULL,
  attempt_no INT NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  error_msg TEXT,
  status ENUM('running','success','failed') DEFAULT 'running'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS calculation_metric_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  indicator_id INT NOT NULL,
  raw_score DECIMAL(12,4) DEFAULT NULL,
  adjusted_score DECIMAL(12,4) DEFAULT NULL,
  final_score DECIMAL(8,2) NOT NULL,
  status ENUM('normal','capped','overridden','excluded') DEFAULT 'normal',
  explanation TEXT,
  UNIQUE KEY uk_cmr (task_id, indicator_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS calculation_steps (
  id INT AUTO_INCREMENT PRIMARY KEY,
  task_id INT NOT NULL,
  step_order INT NOT NULL,
  execution_stage VARCHAR(50) DEFAULT '',
  indicator_id INT DEFAULT NULL,
  exec_rule_id INT DEFAULT NULL,
  input_facts JSON DEFAULT NULL,
  matched_rule JSON DEFAULT NULL,
  computation JSON DEFAULT NULL,
  output_value DECIMAL(12,4) DEFAULT NULL,
  explanation TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS manual_review_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_set_id INT DEFAULT NULL,
  calculation_task_id INT DEFAULT NULL,
  material_id INT DEFAULT NULL,
  target_type ENUM('rule_package','executable_rule','rule_conflict','material_recognition') NOT NULL,
  target_id INT NOT NULL,
  review_stage ENUM('rule_parsing','scoring') NOT NULL,
  question TEXT NOT NULL,
  suggested_decision TEXT,
  decision TEXT,
  review_comment TEXT,
  status ENUM('pending','resolved','escalated') DEFAULT 'pending',
  resolved_by INT DEFAULT NULL,
  reviewed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
--  综测配置表（可动态修改的学院政策）
-- ============================================================
CREATE TABLE IF NOT EXISTS zongce_config (
  config_key VARCHAR(100) PRIMARY KEY,
  config_value JSON NOT NULL,
  enabled TINYINT(1) DEFAULT 1,
  description VARCHAR(500) DEFAULT '',
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- -- 默认奖项认定政策
-- INSERT IGNORE INTO zongce_config (config_key, config_value, enabled, description) VALUES (
--   'college_default_award_policy',
--   '{"participation_tier_ranks":["优秀奖","参与奖","鼓励奖","纪念奖","入围奖"],"maps_to":"encouragement"}',
--   1,
--   '学院默认奖项认定: 优秀奖/参与奖/鼓励奖/纪念奖/入围奖 → participation_tier → encouragement'
-- );

-- -- 插入一个示例批次
-- INSERT INTO assessment_batches 
--   (school_year, title, college, grade, description, start_time, end_time, status, created_by, creator_name)
-- VALUES 
--   ('2024-2025', '2024-2025学年综合测评', '计算机学院', '大三', 
--    '2024-2025学年综合测评，包含F1基本素质、F2课程成绩、F3创新实践',
--    '2025-03-01 00:00:00', '2025-07-31 23:59:59', 
--    'published', 1, 'admin');

-- -- 可以插入多个批次
-- INSERT INTO assessment_batches 
--   (school_year, title, college, grade, start_time, end_time, status, created_by, creator_name)
-- VALUES 
--   ('2023-2024', '2023-2024学年综合测评', '计算机学院', '大二', 
--    '2024-03-01 00:00:00', '2024-07-31 23:59:59', 
--    'published', 1, 'admin');


-- -- 创建一个关联到上述批次的规则集
-- INSERT INTO rule_sets 
--   (user_id, batch_id, version_label, status, published_at)
-- VALUES 
--   (1, 1, '2024-2025学年综合测评规则', 'published', NOW());

-- -- 再创建一个旧批次的规则集
-- INSERT INTO rule_sets 
--   (user_id, batch_id, version_label, status, published_at)
-- VALUES 
--   (1, 2, '2023-2024学年综合测评规则', 'published', NOW());



-- ============================================================
--  升级已有数据库的 ALTER TABLE 语句
--  如果表已存在，需要手动执行以下语句增加新枚举值
-- ============================================================

-- ALTER TABLE rule_sets
--   MODIFY COLUMN status ENUM('draft','published','archived','parse_structure_failed') DEFAULT 'draft';

-- ALTER TABLE document_parse_runs
--   MODIFY COLUMN status ENUM('running','completed','failed','parse_structure_failed') DEFAULT 'running';