"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const {
  serverRoot,
  servicePath,
  routesPath,
  read,
  loadServiceInternals,
} = require("./module3-test-helpers");

const logic = loadServiceInternals();

test("模块三后端核心文件通过 Node 语法检查", () => {
  for (const relative of [
    "src/routes/module3.js",
    "src/controllers/module3Controller.js",
    "src/services/module3/service.js",
    "src/services/module3/migrate.js",
  ]) {
    execFileSync(process.execPath, ["--check", `${serverRoot}/${relative}`], { stdio: "pipe" });
  }
});

test("评价链状态机按批次开关流转", () => {
  assert.equal(logic.nextStatusAfter("assessment_member", "approve", {
    requireCounselorReview: true,
    requireStudentAffairsReview: true,
  }), "pending_counselor");
  assert.equal(logic.nextStatusAfter("assessment_member", "approve", {
    requireCounselorReview: false,
    requireStudentAffairsReview: true,
  }), "pending_student_affairs");
  assert.equal(logic.nextStatusAfter("assessment_member", "approve", {
    requireCounselorReview: false,
    requireStudentAffairsReview: false,
  }), "approved");
  assert.equal(logic.nextStatusAfter("counselor", "approve", {
    requireStudentAffairsReview: true,
  }), "pending_student_affairs");
  assert.equal(logic.nextStatusAfter("student_affairs", "approve", {}), "approved");
  assert.equal(logic.nextStatusAfter("counselor", "return", {}), "returned_by_counselor");
  assert.equal(logic.nextStatusAfter("assessment_member", "reject", {}), "rejected");
});

test("学生编辑权限只在草稿或退回状态开放", () => {
  const published = { status: "published", options: { allowStudentEdit: true, allowReturnEdit: true, lockSubmittedMaterial: false } };
  const settings = {};
  assert.equal(logic.canStudentEdit({ status: "smart_ready" }, published, settings), true);
  assert.equal(logic.canStudentEdit({ status: "returned_by_counselor" }, published, settings), true);
  assert.equal(logic.canStudentEdit({ status: "pending_counselor" }, published, settings), false);
  assert.equal(logic.canStudentEdit({ status: "approved" }, published, settings), false);
  assert.equal(logic.canStudentEdit({ status: "smart_ready" }, { ...published, status: "closed" }, settings), false);
});

test("辅导员范围判断同时限制学院、年级和可选班级", () => {
  const counselor = {
    id: 10,
    role: "counselor",
    scope: { college: "测试学院", grade: "2025", class_ids: [101] },
  };
  assert.equal(logic.isInScope(counselor, { college: "测试学院", grade: "2025", class_id: 101 }), true);
  assert.equal(logic.isInScope(counselor, { college: "测试学院", grade: "2025", class_id: 102 }), false);
  assert.equal(logic.isInScope(counselor, { college: "其他学院", grade: "2025", class_id: 101 }), false);
});

test("等级规则和 ID 归一化逻辑可预测", () => {
  const rules = [
    { grade: "优", min: 85 },
    { grade: "良", min: 75 },
    { grade: "合格", min: 60 },
    { grade: "不合格", min: 0 },
  ];
  assert.equal(logic.calculateLevel(85, rules), "优");
  assert.equal(logic.calculateLevel(74.9, rules), "合格");
  assert.deepEqual(logic.normalizeIds(["2", 2, 0, -1, "x", 3]), [2, 3]);
  assert.equal(logic.isFinalStatus("approved"), true);
  assert.equal(logic.isFinalStatus("pending_counselor"), false);
});

test("关键模块三路由具有角色限制", () => {
  const routes = read(routesPath);
  assert.match(routes, /student\/forms\/:batchId\/submit[\s\S]*roleCheck\("student"\)/);
  assert.match(routes, /batches", auth, roleCheck\("admin"\), ctrl\.createBatch/);
  assert.match(routes, /materials\/:id\/review[\s\S]*roleCheck\("student", "counselor", "student_affairs"\)/);
  assert.match(read(servicePath), /你只能评价分配给自己的待评表单/);
});
