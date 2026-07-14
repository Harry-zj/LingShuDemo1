"use strict";

/*
 * 模块三隔离数据库端到端测试：
 * 1. 自动创建临时数据库；2. 直接写入测试综测表，绕过智能填表；
 * 3. 测试提交、跨班分配、评价小组、辅导员、学生工作处、异议复评；
 * 4. 无论成功失败都删除临时数据库。
 *
 * 运行：MODULE3_E2E_CONFIRM=YES npm run test:module3:e2e
 */

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");

if (process.env.MODULE3_E2E_CONFIRM !== "YES") {
  console.error("为避免误操作，必须显式设置 MODULE3_E2E_CONFIRM=YES。测试只会使用新建的临时数据库。");
  process.exit(2);
}

const root = path.resolve(__dirname, "..");
const stamp = `${Date.now()}_${process.pid}`;
const dbName = `lingshu_module3_e2e_${stamp}`.replace(/[^a-zA-Z0-9_]/g, "");
const connectionOptions = {
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "kk18360",
  charset: "utf8mb4",
  multipleStatements: true,
};

let adminPool;
let testPool;

function statusOf(form) {
  return String(form?.status || "");
}

async function readForm(formId) {
  const [[form]] = await testPool.execute("SELECT * FROM assessment_forms WHERE id=?", [formId]);
  return form;
}

async function readPendingTask(formId, stage) {
  const [[task]] = await testPool.execute(
    "SELECT * FROM assessment_review_tasks WHERE form_id=? AND stage=? AND status='pending' ORDER BY id DESC LIMIT 1",
    [formId, stage]
  );
  return task;
}

async function createUser(role, data = {}) {
  const username = `${role}_${stamp}_${Math.random().toString(16).slice(2, 8)}`.slice(0, 50);
  const [result] = await testPool.execute(
    `INSERT INTO users
      (username, password, role, real_name, student_no, class_id, class_name, college, major, grade)
     VALUES (?, 'test-only', ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      username,
      role,
      data.real_name || username,
      data.student_no || (role === "student" ? username.slice(0, 20) : null),
      data.class_id || null,
      data.class_name || "",
      data.college || "",
      data.major || "",
      data.grade || "",
    ]
  );
  return result.insertId;
}

async function main() {
  adminPool = mysql.createPool(connectionOptions);
  await adminPool.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  testPool = mysql.createPool({ ...connectionOptions, database: dbName, connectionLimit: 5 });

  const initSql = fs.readFileSync(path.join(root, "src/services/zongce/db/init.sql"), "utf8")
    .replace(/^\uFEFF/, "")
    .replace(/CREATE DATABASE IF NOT EXISTS[^;]*;\s*/i, "")
    .replace(/USE\s+lingshu_zongce\s*;\s*/i, "");
  await testPool.query(initSql);

  const { migrateModule3 } = require(path.join(root, "src/services/module3/migrate.js"));
  const migrationConn = await testPool.getConnection();
  try {
    await migrateModule3(migrationConn);
  } finally {
    migrationConn.release();
  }

  // 在加载 service 之前，把数据库模块替换成临时数据库连接池。
  const dbModulePath = require.resolve(path.join(root, "src/config/database.js"));
  require.cache[dbModulePath] = {
    id: dbModulePath,
    filename: dbModulePath,
    loaded: true,
    exports: { pool: testPool, initDatabase: async () => {} },
  };
  const fillServicePath = require.resolve(path.join(root, "src/services/zongce/fillService.js"));
  require.cache[fillServicePath] = {
    id: fillServicePath,
    filename: fillServicePath,
    loaded: true,
    exports: { getFillDataPreview: async () => ({}) },
  };
  const service = require(path.join(root, "src/services/module3/service.js"));

  const college = `自动测试学院_${stamp}`;
  const major = "自动测试专业";
  const grade = "自动测试年级";
  const targetClassId = await service.ensureClass({ name: "测试一班", college, major, grade }, testPool);
  const reviewerClassId = await service.ensureClass({ name: "测试二班", college, major, grade }, testPool);

  const adminId = await createUser("admin", { real_name: "自动测试管理员" });
  const studentId = await createUser("student", {
    real_name: "被评学生",
    student_no: `S${String(Date.now()).slice(-12)}`,
    class_id: targetClassId,
    class_name: "测试一班",
    college,
    major,
    grade,
  });
  const reviewerId = await createUser("student", {
    real_name: "评价小组成员",
    student_no: `R${String(Date.now()).slice(-12)}`,
    class_id: reviewerClassId,
    class_name: "测试二班",
    college,
    major,
    grade,
  });
  const counselorId = await createUser("counselor", { real_name: "自动测试辅导员", college, grade });
  await createUser("student_affairs", { real_name: "自动测试学生工作处" });
  await testPool.execute(
    "INSERT INTO counselor_scopes (counselor_id, college, grade, class_ids) VALUES (?, ?, ?, ?)",
    [counselorId, college, grade, JSON.stringify([targetClassId])]
  );

  const schoolStart = new Date().getMonth() + 1 >= 9 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  const options = {
    allowStudentEdit: true,
    allowReturnEdit: true,
    requireReviewerComment: false,
    requireCounselorReview: true,
    requireStudentAffairsReview: true,
    lockSubmittedMaterial: false,
    objectionDays: 7,
  };
  const [batchResult] = await testPool.execute(
    `INSERT INTO assessment_batches
      (school_year, title, college, grade, start_time, end_time, status, created_by, creator_name, options)
     VALUES (?, ?, ?, ?, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_ADD(NOW(), INTERVAL 10 DAY), 'published', ?, '自动测试', ?)`,
    [`${schoolStart}-${schoolStart + 1}`, `模块三自动测试_${stamp}`, college, grade, adminId, JSON.stringify(options)]
  );
  const batchId = batchResult.insertId;
  await testPool.execute(
    `INSERT INTO assessment_review_assignments
      (batch_id, target_class_id, target_class_name, reviewer_class_id, reviewer_class_name, created_by)
     VALUES (?, ?, '测试一班', ?, '测试二班', ?)`,
    [batchId, targetClassId, reviewerClassId, adminId]
  );
  await testPool.execute(
    `INSERT INTO assessment_batch_members (batch_id, student_id, assigned_by, status)
     VALUES (?, ?, ?, 'active')`,
    [batchId, reviewerId, adminId]
  );

  const initialScores = { f1_basic_quality: 80, f2_course_learning: 80, f3_innovation_practice: 20, total: 65 };
  const [formResult] = await testPool.execute(
    `INSERT INTO assessment_forms
      (batch_id, batch_title, student_id, student_name, student_no, college, major, grade, class_id, class_name,
       from_smart_fill, is_demo, status, level, scores, personal_summary)
     VALUES (?, ?, ?, '被评学生', 'TEST-STUDENT', ?, ?, ?, ?, '测试一班', 0, 0, 'smart_ready', '合格', ?, '自动测试表单')`,
    [batchId, `模块三自动测试_${stamp}`, studentId, college, major, grade, targetClassId, JSON.stringify(initialScores)]
  );
  const formId = formResult.insertId;
  const [itemResult] = await testPool.execute(
    `INSERT INTO assessment_form_items
      (form_id, section, sub_key, title, reason, score, evidence_ids, editable, sort_order)
     VALUES (?, 'F3', 'B1', '自动测试加分项', '绕过智能填表生成', 20, JSON_ARRAY(), 1, 1)`,
    [formId]
  );
  const itemId = itemResult.insertId;

  const submitted = await service.submitSmartResult(studentId, { batch_id: batchId });
  assert.equal(statusOf(submitted), "pending_class_committee");
  const memberTask = await readPendingTask(formId, "assessment_member");
  assert.equal(Number(memberTask.reviewer_id), reviewerId);

  const reviewer = await service.getUser(reviewerId);
  await service.reviewForm(formId, reviewer, {
    action: "approve",
    comment: "评价小组通过",
    level: "合格",
    item_reviews: [{ item_id: itemId, action: "approve", reason: "符合", score: 20 }],
  });
  assert.equal(statusOf(await readForm(formId)), "pending_counselor");

  const counselorTask = await readPendingTask(formId, "counselor");
  assert.ok(counselorTask, "应自动分配辅导员任务");
  const counselor = await service.getUser(counselorTask.reviewer_id);
  await service.reviewForm(formId, counselor, {
    action: "approve",
    comment: "辅导员通过",
    level: "合格",
    item_reviews: [{ item_id: itemId, action: "approve", reason: "符合", score: 20 }],
  });
  assert.equal(statusOf(await readForm(formId)), "pending_student_affairs");

  const affairsTask = await readPendingTask(formId, "student_affairs");
  assert.ok(affairsTask, "应自动分配学生工作处任务");
  const affairs = await service.getUser(affairsTask.reviewer_id);
  await service.reviewForm(formId, affairs, {
    action: "approve",
    comment: "学生工作处通过",
    item_reviews: [{ item_id: itemId, action: "approve", reason: "符合", score: 20 }],
  });
  const approved = await readForm(formId);
  assert.equal(statusOf(approved), "approved");
  assert.ok(approved.result_released_at, "最终通过后应释放结果");

  const student = await service.getUser(studentId);
  await service.submitObjection(formId, student, {
    items: [{ item_id: itemId, reason: "申请将复核分值调整为 10 分" }],
  });
  assert.equal(statusOf(await readForm(formId)), "pending_objection_review");
  const objectionTask = await readPendingTask(formId, "objection");
  assert.equal(Number(objectionTask.reviewer_id), reviewerId);

  await service.reviewForm(formId, reviewer, {
    action: "approve",
    comment: "异议复评完成",
    item_reviews: [{ item_id: itemId, action: "approve", reason: "调整为 10 分", score: 10 }],
  });
  const afterObjection = await readForm(formId);
  assert.equal(statusOf(afterObjection), "approved");

  const [[afterItem]] = await testPool.execute("SELECT score FROM assessment_form_items WHERE id=?", [itemId]);
  assert.equal(Number(afterItem.score), 10, "复核分值没有写回 assessment_form_items.score");
  const finalScores = typeof afterObjection.scores === "string" ? JSON.parse(afterObjection.scores) : afterObjection.scores;
  assert.equal(Number(finalScores.total), 2.5, "复核后没有重新计算表单总分");
  assert.equal(afterObjection.level, "不合格", "复核后没有重新计算自动等级");

  console.log("模块三隔离端到端测试通过。临时数据库：", dbName);
}

main()
  .catch(error => {
    console.error("模块三隔离端到端测试失败：", error.stack || error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    try { if (testPool) await testPool.end(); } catch (_) {}
    try {
      if (adminPool) {
        await adminPool.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
        await adminPool.end();
      }
    } catch (cleanupError) {
      console.error("临时数据库清理失败，请手动删除：", dbName, cleanupError.message);
      process.exitCode = 1;
    }
  });
