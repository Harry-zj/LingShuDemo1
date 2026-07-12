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
  file_hash CHAR(64) DEFAULT NULL,
  is_frozen TINYINT(1) DEFAULT 0,
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

-- ============================================================
-- V2 规则系统（与 V1 表共存，增量升级）
-- ============================================================

CREATE TABLE IF NOT EXISTS rule_sets (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
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

CREATE TABLE IF NOT EXISTS indicator_nodes (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_set_id INT NOT NULL,
  canonical_key VARCHAR(200) NOT NULL,
  code VARCHAR(50) DEFAULT '',
  name VARCHAR(500) DEFAULT '',
  parent_id INT DEFAULT NULL,
  weight DECIMAL(5,4) DEFAULT NULL,
  calc_method ENUM('sum_children','weighted_sum','formula_ast','lookup','direct') DEFAULT 'sum_children',
  formula_ast JSON DEFAULT NULL,
  max_score DECIMAL(6,2) DEFAULT NULL,
  min_score DECIMAL(6,2) DEFAULT 0,
  sort_order INT DEFAULT 0,
  status ENUM('pending_review','confirmed') DEFAULT 'pending_review',
  UNIQUE KEY uk_ind (rule_set_id, canonical_key),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rule_packages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_set_id INT NOT NULL,
  indicator_id INT DEFAULT NULL,
  canonical_key VARCHAR(200) NOT NULL,
  name VARCHAR(500) DEFAULT '',
  summary TEXT,
  auto_level ENUM('automatic','assisted','manual_required') DEFAULT 'automatic',
  status ENUM('pending_review','confirmed','rejected') DEFAULT 'pending_review',
  conflict_note TEXT,
  UNIQUE KEY uk_rp (rule_set_id, canonical_key),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS executable_rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  package_id INT NOT NULL,
  canonical_key VARCHAR(200) NOT NULL,
  rule_type ENUM('fixed','per_unit','tiered','lookup','formula_ast',
    'coefficient','cap','dedup','eligibility','manual',
    'normalization','evidence_policy','override','outcome_constraint') NOT NULL,
  name VARCHAR(500) DEFAULT '',
  config JSON NOT NULL,
  config_version VARCHAR(20) DEFAULT 'v1',
  input_selector JSON DEFAULT NULL,
  condition_config JSON DEFAULT NULL,
  application_scope ENUM('per_fact','per_material','per_group','per_indicator','global') DEFAULT 'per_fact',
  group_by_config JSON DEFAULT NULL,
  execution_stage VARCHAR(50) DEFAULT 'base_score',
  priority INT DEFAULT 0,
  proof_required JSON DEFAULT NULL,
  auto_level ENUM('automatic','assisted','manual_required') DEFAULT 'automatic',
  status ENUM('pending_review','confirmed','rejected') DEFAULT 'pending_review',
  UNIQUE KEY uk_er (package_id, canonical_key),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS executable_rule_dependencies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_id INT NOT NULL,
  depends_on_rule_id INT NOT NULL,
  dependency_type ENUM('requires','after') DEFAULT 'requires',
  UNIQUE KEY uk_erd (rule_id, depends_on_rule_id, dependency_type),
  CHECK (rule_id != depends_on_rule_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS executable_rule_exclusions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_a_id INT NOT NULL,
  rule_b_id INT NOT NULL,
  resolution_strategy ENUM('take_higher_priority','take_higher_score','manual_review','keep_first') DEFAULT 'manual_review',
  UNIQUE KEY uk_ere (rule_a_id, rule_b_id),
  CHECK (rule_a_id < rule_b_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lookup_tables (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_set_id INT NOT NULL,
  canonical_key VARCHAR(200) NOT NULL,
  name VARCHAR(500) DEFAULT '',
  UNIQUE KEY uk_lt (rule_set_id, canonical_key),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lookup_dimensions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  table_id INT NOT NULL,
  dim_name VARCHAR(100) DEFAULT '',
  dim_label VARCHAR(200) DEFAULT '',
  sort_order INT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS lookup_cells (
  id INT AUTO_INCREMENT PRIMARY KEY,
  table_id INT NOT NULL,
  dimension_values JSON NOT NULL,
  dimension_hash CHAR(64) NOT NULL,
  value DECIMAL(6,2) NOT NULL,
  UNIQUE KEY uk_lc (table_id, dimension_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rule_source_refs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  entity_type ENUM('indicator_node','rule_package','executable_rule','lookup_cell') NOT NULL,
  entity_id INT NOT NULL,
  doc_block_id INT NOT NULL,
  relation_type ENUM('defines','modifies','overrides','clarifies','provides_evidence') DEFAULT 'defines',
  parse_confidence DECIMAL(5,4) DEFAULT NULL,
  INDEX idx_rsr (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rule_conflicts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  rule_set_id INT NOT NULL,
  canonical_key VARCHAR(200) DEFAULT '',
  conflict_type ENUM('value_mismatch','strategy_mismatch','scope_overlap','timing_conflict','other'),
  description TEXT,
  suggested_resolution TEXT,
  status ENUM('open','resolved_auto','resolved_manual','escalated') DEFAULT 'open',
  resolved_by INT DEFAULT NULL,
  resolution TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS rule_conflict_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  conflict_id INT NOT NULL,
  entity_type ENUM('executable_rule','rule_package','indicator_node','lookup_cell') NOT NULL,
  entity_id INT NOT NULL,
  side ENUM('a','b') DEFAULT 'a',
  doc_block_id INT DEFAULT NULL,
  UNIQUE KEY uk_rci (conflict_id, entity_type, entity_id)
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

-- 默认奖项认定政策
INSERT IGNORE INTO zongce_config (config_key, config_value, enabled, description) VALUES (
  'college_default_award_policy',
  '{"participation_tier_ranks":["优秀奖","参与奖","鼓励奖","纪念奖","入围奖"],"maps_to":"encouragement"}',
  1,
  '学院默认奖项认定: 优秀奖/参与奖/鼓励奖/纪念奖/入围奖 → participation_tier → encouragement'
);

-- ============================================================
--  升级已有数据库的 ALTER TABLE 语句
--  如果表已存在，需要手动执行以下语句增加新枚举值
-- ============================================================

-- ALTER TABLE rule_sets
--   MODIFY COLUMN status ENUM('draft','published','archived','parse_structure_failed') DEFAULT 'draft';

-- ALTER TABLE document_parse_runs
--   MODIFY COLUMN status ENUM('running','completed','failed','parse_structure_failed') DEFAULT 'running';
