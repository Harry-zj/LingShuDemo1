-- ============================================================
--  V4.0 Migration: link rule_sets to assessment_batches
--  使 rule_sets 关联到具体的测评批次，不同批次可使用不同规则集
--  Run: mysql -u root -p lingshu_zongce < migrate_v4_batch_rule_set.sql
-- ============================================================

-- 1. 为 rule_sets 表增加 batch_id 列，允许为 NULL（兼容已有数据）
ALTER TABLE rule_sets
  ADD COLUMN batch_id INT DEFAULT NULL AFTER user_id,
  ADD INDEX idx_rule_sets_batch (batch_id);

-- 2. 为 smart_fill_data 表增加 batch_id 列
ALTER TABLE smart_fill_data
  ADD COLUMN batch_id INT DEFAULT NULL AFTER rule_set_id,
  ADD INDEX idx_sfd_batch (batch_id);
