-- ============================================================
--  V3.0 Migration: simplify rule system
--  Drops 12 V1/V2 tables, adds 1 scoring_rules table
--  Run: mysql -u root -p lingshu_zongce < migrate_v3.sql
-- ============================================================

-- 1. Drop old V1/V2 rule tables
DROP TABLE IF EXISTS rule_conflict_items;
DROP TABLE IF EXISTS rule_conflicts;
DROP TABLE IF EXISTS rule_source_refs;
DROP TABLE IF EXISTS lookup_cells;
DROP TABLE IF EXISTS lookup_dimensions;
DROP TABLE IF EXISTS lookup_tables;
DROP TABLE IF EXISTS executable_rule_exclusions;
DROP TABLE IF EXISTS executable_rule_dependencies;
DROP TABLE IF EXISTS executable_rules;
DROP TABLE IF EXISTS rule_packages;
DROP TABLE IF EXISTS indicator_nodes;
DROP TABLE IF EXISTS rule_items;

-- 2. Create simplified scoring rules table
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
  INDEX idx_rule_set (rule_set_id),
  INDEX idx_user (user_id),
  INDEX idx_item_key (item_key),
  INDEX idx_level_rank (score_level, score_rank)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
