-- ============================================================
-- 灵枢 · 综测核心引擎 · 数据库初始化脚本
-- 使用：mysql -u root -p < server/db/init.sql
-- 说明：app启动时也会自动执行此脚本建库建表
-- ============================================================

CREATE DATABASE IF NOT EXISTS lingshu_zongce
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE lingshu_zongce;

-- ============================================================
-- 一、用户表（核心模块精简版）
-- ============================================================
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  role ENUM('student','class_leader','teacher') NOT NULL DEFAULT 'student',
  real_name VARCHAR(50) DEFAULT '',
  class_id INT DEFAULT NULL,
  phone VARCHAR(20) DEFAULT '',
  avatar VARCHAR(255) DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 二、规则来源表（上传的原始文件/文字记录）
-- ============================================================
CREATE TABLE IF NOT EXISTS rule_sources (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  source_type ENUM('file','text') NOT NULL,
  -- file: Word/Excel/PDF/图片上传
  -- text: 对话框输入的文字约束
  file_name VARCHAR(255) DEFAULT '',
  file_path VARCHAR(500) DEFAULT '',
  original_text LONGTEXT,                  -- 提取出的原始文本 / 用户手打的文字
  status ENUM('pending','parsed') DEFAULT 'pending',
  file_hash CHAR(64) DEFAULT NULL,
  is_frozen TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 三、规则项表（解析后的每一条具体规则，★ 核心 ★）
-- ============================================================
CREATE TABLE IF NOT EXISTS rule_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  source_id INT DEFAULT NULL,              -- FK → rule_sources.id，NULL=手动创建
  category VARCHAR(50) DEFAULT NULL,
  -- moral / intellectual / physical / aesthetic / labor
  -- NULL = 全局规则，所有维度都适用
  description TEXT NOT NULL,
  -- "国家级荣誉称号" / "每大类上限30分" / "同类荣誉称号只取最高分"
  level VARCHAR(20) DEFAULT NULL,
  -- national / provincial / school / college  （仅scoring类使用）
  score DECIMAL(5,2) DEFAULT NULL,
  -- 加分/扣分值（limit和conflict类为NULL）
  rule_type ENUM('scoring','limit','conflict') NOT NULL DEFAULT 'scoring',
  -- scoring: 加分项  limit: 上限约束  conflict: 冲突规则
  limit_value DECIMAL(5,2) DEFAULT NULL,
  -- limit类型：上限值（如20、30）
  scope VARCHAR(50) DEFAULT NULL,
  -- 作用范围：dimension（单维度）| global（全局）
  strategy VARCHAR(50) DEFAULT NULL,
  -- 处理策略：take_highest（择高）| dedup（去重）| cap（封顶）
  max_times INT DEFAULT 1,
  conflict_group VARCHAR(100) DEFAULT NULL,
  -- 互斥组名，同组内只取最高分。如 "honor_title" 组包含国家/省/校级荣誉称号
  proof_required JSON DEFAULT NULL,
  -- ["证书扫描件","表彰文件"]
  status ENUM('pending_confirm','confirmed') DEFAULT 'pending_confirm',
  -- AI解析后=pending_confirm，用户确认后=confirmed，仅confirmed参与评分
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ★ 数据示例（帮助理解三种 rule_type）：
-- ┌────┬──────────┬──────────────────────┬────────────┬───────┬───────────┬─────────────────┐
-- │ id │ category │ description           │ level      │ score │ rule_type │ conflict_group  │
-- ├────┼──────────┼──────────────────────┼────────────┼───────┼───────────┼─────────────────┤
-- │ 1  │ NULL     │ 每大类上限30分         │ NULL       │ NULL  │ limit     │ NULL            │
-- │ 2  │ moral    │ 德育总分上限20分       │ NULL       │ NULL  │ limit     │ NULL            │
-- │ 3  │ moral    │ 国家级荣誉称号         │ national   │ 5.0   │ scoring   │ honor_title     │
-- │ 4  │ moral    │ 省级荣誉称号           │ provincial │ 3.0   │ scoring   │ honor_title     │
-- │ 5  │ moral    │ 校级荣誉称号           │ school     │ 1.0   │ scoring   │ honor_title     │
-- │ 6  │ NULL     │ 同类荣誉称号只取最高分  │ NULL       │ NULL  │ conflict  │ honor_title     │
-- └────┴──────────┴──────────────────────┴────────────┴───────┴───────────┴─────────────────┘

-- ============================================================
-- 四、材料表
-- ============================================================
CREATE TABLE IF NOT EXISTS materials (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,              -- "全国优秀共青团员证书"
  category VARCHAR(50) DEFAULT '',          -- 同步自recognition，方便列表筛选
  status ENUM('draft','submitted') DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 五、附件表（材料的证明文件）
-- ============================================================
CREATE TABLE IF NOT EXISTS attachments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_id INT NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  file_type VARCHAR(50) DEFAULT '',
  file_size INT DEFAULT 0,
  ai_label VARCHAR(100) DEFAULT '',          -- AI分类标签 "荣誉证书/国家级"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 六、材料识别文段表（AI分析产物，★ 核心 ★）
-- ============================================================
CREATE TABLE IF NOT EXISTS material_recognitions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  material_id INT NOT NULL,
  category VARCHAR(50) DEFAULT '',          -- moral / intellectual / physical / aesthetic / labor
  explanation TEXT,                         -- ★ AI解释文本（核心输出）
  matched_rule_ids JSON DEFAULT NULL,       -- 匹配到的 rule_items.id 列表，如 [3, 8]
  confidence DECIMAL(5,4) DEFAULT NULL,     -- AI置信度 0.0000 ~ 1.0000（与识别文段分离关注）
  confirm_status ENUM('pending','confirmed','dismissed') DEFAULT 'pending',
  -- pending:   等待学生确认（显示 [确认] [舍弃] 按钮）
  -- confirmed: 学生认可 → 参与评分
  -- dismissed: 学生舍弃 → 不参与评分
  raw_ai_response JSON DEFAULT NULL,        -- AI原始返回（排查问题用）
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 七、评定结果表
-- ============================================================
CREATE TABLE IF NOT EXISTS evaluation_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  total_score DECIMAL(6,2) DEFAULT 0.00,
  dimension_scores JSON DEFAULT NULL,
  /*
  {
    "moral": {
      "score": 15.0, "max": 20.0,
      "detail_text": "国家级荣誉称号+5（全国优秀共青团员），志愿服务+10（40小时）",
      "items": [
        { "rule_id": 3, "desc": "国家级荣誉称号", "score": 5.0, "material_id": 1 }
      ]
    },
    "intellectual": { ... },
    "physical": { ... },
    "aesthetic": { ... },
    "labor": { ... }
  }
  */
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 八、填表模板表
-- ============================================================
CREATE TABLE IF NOT EXISTS fill_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  name VARCHAR(200) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 九、填充字段表（模板中每个 {xxx} 占位符的数据映射）
-- ============================================================
CREATE TABLE IF NOT EXISTS fill_fields (
  id INT AUTO_INCREMENT PRIMARY KEY,
  template_id INT NOT NULL,
  placeholder VARCHAR(100) NOT NULL,        -- "total_score"
  label VARCHAR(100) DEFAULT '',            -- "总分"
  data_source VARCHAR(200) NOT NULL,        -- "evaluation.total_score"
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 十、AI任务追踪表
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  target_type VARCHAR(50) NOT NULL,         -- 'rule_parse' | 'material_recognize'
  target_id INT NOT NULL,                   -- rule_sources.id 或 materials.id
  status ENUM('pending','processing','completed','failed') DEFAULT 'pending',
  result JSON DEFAULT NULL,
  error_msg TEXT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL DEFAULT NULL
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
  status ENUM('running','completed','failed') DEFAULT 'running',
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
  status ENUM('running','completed','failed') DEFAULT 'running',
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
