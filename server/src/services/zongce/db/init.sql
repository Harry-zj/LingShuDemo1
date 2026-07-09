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
