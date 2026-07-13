"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const {
  serverRoot,
  servicePath,
  routesPath,
  read,
  between,
} = require("./module3-test-helpers");

const service = read(servicePath);
const routes = read(routesPath);
const migrate = read(path.join(serverRoot, "src/services/module3/migrate.js"));
const fillService = read(path.join(serverRoot, "src/services/zongce/fillService.js"));
const fillController = read(path.join(serverRoot, "src/controllers/zongce/fillController.js"));
const chatFillController = read(path.join(serverRoot, "src/controllers/zongce/chatFillController.js"));
const initSql = read(path.join(serverRoot, "src/services/zongce/db/init.sql"));
const clientApi = read(path.resolve(serverRoot, "../client/src/api/zongce.js"));
const smartFillView = read(path.resolve(serverRoot, "../client/src/views/zongce/SmartFill.vue"));
const smartFillForm = read(path.resolve(serverRoot, "../client/src/views/zongce/SmartFillForm.vue"));

test("复核分值写回项目，并重新计算表单总分和自动等级", () => {
  const saveBlock = between(service, "async function saveItemReviews", "async function submitObjection");
  assert.match(saveBlock, /Number\.isFinite\(reviewedScore\)/);
  assert.match(saveBlock, /reviewedScore\s*<\s*0/);

  const reviewBlock = between(service, "async function reviewForm", "async function getStatistics");
  assert.match(reviewBlock, /UPDATE assessment_form_items SET score=\?/);
  assert.match(reviewBlock, /SELECT section, score FROM assessment_form_items/);
  assert.match(reviewBlock, /recalculatedScores\s*=\s*calculateSmartFillScores\(scoreItems\)/);
  assert.match(reviewBlock, /SET status=\?, scores=\?, level=\?, manual_level=\?/);
});

test("单独等级接口禁止学生调用，并要求当前阶段的本人待评任务", () => {
  const routeLine = routes.split(/\r?\n/).find(line => line.includes('/forms/:id/level')) || "";
  assert.doesNotMatch(routeLine, /roleCheck\([^)]*"student"/);
  assert.match(routeLine, /roleCheck\("counselor", "student_affairs"\)/);

  const levelBlock = between(service, "async function setFormLevel", "async function reviewForm");
  assert.match(levelBlock, /form\.status !== "pending_counselor"/);
  assert.match(levelBlock, /form\.status !== "pending_student_affairs"/);
  assert.match(levelBlock, /isInScope\(operator, form\)/);
  assert.match(levelBlock, /assessment_review_tasks/);
  assert.match(levelBlock, /reviewer_id=\?/);
  assert.match(levelBlock, /stage=\?/);
  assert.match(levelBlock, /status='pending'/);
});

test("智能填表结果、规则集和预览数据均严格绑定当前批次", () => {
  const sourceBlock = between(service, "async function getLatestSmartFillSource", "async function getWordDocumentMetadata");
  assert.match(sourceBlock, /getLatestSmartFillSource\(studentId, batchId/);
  assert.match(sourceBlock, /rule_sets[\s\S]*batch_id=\?/);
  assert.match(sourceBlock, /fill_results[\s\S]*batch_id=\?/);
  assert.match(sourceBlock, /getFillDataPreview\(studentId, normalizedBatchId\)/);

  const syncBlock = between(service, "async function syncStudentSmartFillForm", "async function uploadStudentSupportMaterials");
  assert.match(syncBlock, /getLatestSmartFillSource\(student\.id, batch\.id\)/);
  assert.match(syncBlock, /smart_fill_rule_set_id/);

  const wordBlock = between(service, "async function getWordDocumentMetadata", "async function deleteFormCascade");
  assert.match(wordBlock, /batch_id=\?/);
  assert.match(wordBlock, /form\.batch_id/);

  assert.match(migrate, /ALTER TABLE fill_results ADD COLUMN batch_id/);
  assert.match(migrate, /idx_fill_results_user_batch/);
  assert.match(initSql, /CREATE TABLE IF NOT EXISTS fill_results[\s\S]*batch_id INT DEFAULT NULL/);
  assert.match(fillController, /INSERT INTO fill_results \(user_id, batch_id,/);
  assert.match(chatFillController, /INSERT INTO fill_results \(user_id, batch_id,/);
  assert.match(fillService, /\[userId, batchId \|\| null, batchId \|\| null\]/);
  assert.match(fillService, /AND rmr\.rule_set_id = \?/);
  assert.match(fillService, /\[userId, ruleSetId\]/);
  assert.match(clientApi, /params:\s*batchId \? \{ batch_id: batchId \} : \{\}/);
  assert.match(smartFillView, /:batchId="selectedBatchId"/);
  assert.match(smartFillForm, /batchId: Number/);
  assert.match(smartFillForm, /getFillPreview\(props\.batchId\)/);
  assert.match(smartFillForm, /saveFillData\(items, props\.batchId\)/);
  assert.match(smartFillForm, /doFill\(upRes\.data\.id, props\.batchId\)/);
});
