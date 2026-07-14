async function tryQuery(conn, sql, params = []) {
  try {
    await conn.execute(sql, params);
    return true;
  } catch (error) {
    const ignorable = new Set([
      "ER_DUP_FIELDNAME",
      "ER_DUP_KEYNAME",
      "ER_CANT_DROP_FIELD_OR_KEY",
      "ER_TABLE_EXISTS_ERROR",
    ]);
    if (!ignorable.has(error.code)) throw error;
    return false;
  }
}

function inferSchoolYear(title, startTime) {
  const matched = String(title || "").match(/(\d{4})-(\d{4})/);
  if (matched && Number(matched[2]) === Number(matched[1]) + 1) {
    return `${matched[1]}-${matched[2]}`;
  }
  if (startTime) {
    const date = new Date(startTime);
    if (!Number.isNaN(date.getTime())) {
      const year = date.getFullYear();
      const start = date.getMonth() + 1 >= 9 ? year : year - 1;
      return `${start}-${start + 1}`;
    }
  }
  return "";
}

async function createModule3Tables(conn) {
  await conn.query(`
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
  `);
}

async function backfillClasses(conn) {
  const [rows] = await conn.query(`
    SELECT class_id, class_name AS name, college, major, grade
    FROM users
    WHERE role = 'student' AND class_name <> ''
    UNION ALL
    SELECT class_id, class_name AS name, college, major, grade
    FROM assessment_forms
    WHERE class_name <> ''
  `);

  for (const row of rows) {
    const classId = Number(row.class_id);
    if (Number.isInteger(classId) && classId > 0) {
      await conn.execute(
        "INSERT IGNORE INTO assessment_classes (id, name, college, major, grade) VALUES (?, ?, ?, ?, ?)",
        [classId, row.name || "", row.college || "", row.major || "", row.grade || ""]
      );
    }
    await conn.execute(
      "INSERT IGNORE INTO assessment_classes (name, college, major, grade) VALUES (?, ?, ?, ?)",
      [row.name || "", row.college || "", row.major || "", row.grade || ""]
    );
  }

  // 以班级表为唯一事实来源，统一旧用户/旧表单中的 class_id，避免名称相同但 ID 对不上。
  await conn.query(`
    UPDATE users u
    JOIN assessment_classes c
      ON c.name = u.class_name
     AND c.college = u.college
     AND c.major = COALESCE(u.major, '')
     AND c.grade = u.grade
    SET u.class_id = c.id
    WHERE u.role = 'student'
  `);

  await conn.query(`
    UPDATE assessment_forms f
    JOIN assessment_classes c
      ON c.name = f.class_name
     AND c.college = f.college
     AND c.major = COALESCE(f.major, '')
     AND c.grade = f.grade
    SET f.class_id = c.id
  `);
}

async function backfillBatches(conn) {
  const [batches] = await conn.query(`
    SELECT b.id, b.title, b.start_time, b.school_year, b.college, b.grade,
           (SELECT f.college FROM assessment_forms f WHERE f.batch_id = b.id AND f.college <> '' ORDER BY f.id LIMIT 1) AS form_college,
           (SELECT f.grade FROM assessment_forms f WHERE f.batch_id = b.id AND f.grade <> '' ORDER BY f.id LIMIT 1) AS form_grade
    FROM assessment_batches b
  `);

  for (const batch of batches) {
    const schoolYear = batch.school_year || inferSchoolYear(batch.title, batch.start_time);
    const college = batch.college || batch.form_college || "";
    const grade = batch.grade || batch.form_grade || "";
    await conn.execute(
      "UPDATE assessment_batches SET school_year = ?, college = ?, grade = ? WHERE id = ?",
      [schoolYear, college, grade, batch.id]
    );
  }
}

async function backfillOrganizations(conn) {
  const [scopes] = await conn.query(`
    SELECT DISTINCT college, major
    FROM users
    WHERE college <> ''
    UNION
    SELECT DISTINCT college, major
    FROM assessment_forms
    WHERE college <> ''
    UNION
    SELECT DISTINCT college, major
    FROM assessment_classes
    WHERE college <> ''
  `);

  for (const row of scopes) {
    await conn.execute(
      "INSERT INTO assessment_colleges (name) VALUES (?) ON DUPLICATE KEY UPDATE is_active=VALUES(is_active)",
      [row.college || ""]
    );
    const [[college]] = await conn.execute("SELECT id FROM assessment_colleges WHERE name=? LIMIT 1", [row.college || ""]);
    if (college?.id && row.major) {
      await conn.execute(
        "INSERT INTO assessment_majors (college_id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE is_active=VALUES(is_active)",
        [college.id, row.major]
      );
    }
  }
}

async function removeLegacyDemoForms(conn) {
  await conn.query(`DELETE r FROM assessment_item_reviews r JOIN assessment_forms f ON f.id=r.form_id WHERE f.is_demo=1`);
  await conn.query(`DELETE o FROM assessment_objections o JOIN assessment_forms f ON f.id=o.form_id WHERE f.is_demo=1`);
  await conn.query(`DELETE r FROM assessment_review_records r JOIN assessment_forms f ON f.id=r.form_id WHERE f.is_demo=1`);
  await conn.query(`DELETE t FROM assessment_review_tasks t JOIN assessment_forms f ON f.id=t.form_id WHERE f.is_demo=1`);
  await conn.query(`DELETE i FROM assessment_form_items i JOIN assessment_forms f ON f.id=i.form_id WHERE f.is_demo=1`);
  await conn.query("DELETE FROM assessment_forms WHERE is_demo=1");
}

async function migrateModule3(conn) {
  await tryQuery(conn, "ALTER TABLE users ADD COLUMN is_assessment_member TINYINT(1) NOT NULL DEFAULT 0 AFTER role");
  await tryQuery(conn, "ALTER TABLE assessment_batches ADD COLUMN school_year VARCHAR(20) NOT NULL DEFAULT '' AFTER id");
  await tryQuery(conn, "ALTER TABLE assessment_batches ADD COLUMN college VARCHAR(100) NOT NULL DEFAULT '' AFTER title");
  await tryQuery(conn, "ALTER TABLE assessment_batches ADD COLUMN grade VARCHAR(20) NOT NULL DEFAULT '' AFTER college");
  await tryQuery(conn, "ALTER TABLE assessment_batches ADD KEY idx_batch_scope (college, grade, school_year)");

  await createModule3Tables(conn);
  await tryQuery(conn, "ALTER TABLE fill_results ADD COLUMN batch_id INT DEFAULT NULL AFTER user_id");
  await tryQuery(conn, "ALTER TABLE fill_results ADD INDEX idx_fill_results_user_batch (user_id, batch_id, created_at)");
  await tryQuery(conn, "ALTER TABLE assessment_forms ADD COLUMN is_demo TINYINT(1) NOT NULL DEFAULT 0 AFTER from_smart_fill");
  await tryQuery(conn, "ALTER TABLE assessment_forms ADD COLUMN fill_result_id INT DEFAULT NULL AFTER is_demo");
  await tryQuery(conn, "ALTER TABLE assessment_forms ADD COLUMN smart_fill_rule_set_id INT DEFAULT NULL AFTER fill_result_id");
  await tryQuery(conn, "ALTER TABLE assessment_forms ADD COLUMN smart_fill_synced_at DATETIME DEFAULT NULL AFTER smart_fill_rule_set_id");
  await tryQuery(conn, "ALTER TABLE assessment_forms ADD COLUMN result_released_at DATETIME DEFAULT NULL AFTER personal_summary");
  await tryQuery(conn, "ALTER TABLE assessment_forms ADD COLUMN pre_objection_status VARCHAR(50) NOT NULL DEFAULT '' AFTER result_released_at");
  await tryQuery(conn, "ALTER TABLE assessment_review_tasks ADD COLUMN stage VARCHAR(30) NOT NULL DEFAULT 'initial' AFTER status");
  await tryQuery(conn, "ALTER TABLE assessment_review_tasks ADD KEY idx_task_batch_status_stage (batch_id, status, stage)");
  await tryQuery(conn, "ALTER TABLE assessment_classes ADD COLUMN major VARCHAR(100) NOT NULL DEFAULT '' AFTER college");
  await tryQuery(conn, "ALTER TABLE assessment_classes ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'active' AFTER grade");
  await tryQuery(conn, "ALTER TABLE assessment_classes DROP INDEX uk_assessment_class");
  await tryQuery(conn, "ALTER TABLE assessment_classes ADD UNIQUE KEY uk_assessment_class_scope (college, major, grade, name)");
  await backfillClasses(conn);
  await backfillOrganizations(conn);
  await backfillBatches(conn);
  await removeLegacyDemoForms(conn);

  const bcrypt = require("bcryptjs");
  const adminPwd = await bcrypt.hash("a000001", 10);
  await conn.execute(
    "INSERT IGNORE INTO users (id, username, password, role) VALUES (1, 'a000001', ?, 'admin')",
    [adminPwd]
  );

  // 新数据库可直接建立唯一约束；旧数据库若已有重复数据则保留数据并跳过。
  try {
    await conn.query("ALTER TABLE assessment_forms ADD UNIQUE KEY uk_student_batch (student_id, batch_id)");
  } catch (error) {
    if (!["ER_DUP_KEYNAME", "ER_DUP_ENTRY"].includes(error.code)) throw error;
    if (error.code === "ER_DUP_ENTRY") {
      console.warn("[DB] assessment_forms 存在同一学生同一批次的重复数据，已保留原数据并跳过唯一索引；请人工核对后再添加 uk_student_batch");
    }
  }

  console.log("[DB] 模块三兼容迁移完成");
}

module.exports = { migrateModule3 };
