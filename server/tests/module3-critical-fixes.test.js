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
const initSql = read(path.join(serverRoot, "src/services/zongce/db/init.sql"));
const clientApi = read(path.resolve(serverRoot, "../client/src/api/zongce.js"));
const smartFillView = read(path.resolve(serverRoot, "../client/src/views/zongce/SmartFill.vue"));
const smartFillForm = read(path.resolve(serverRoot, "../client/src/views/zongce/SmartFillForm.vue"));
const module3ClientApi = read(path.resolve(serverRoot, "../client/src/api/module3.js"));

test("复核分值受管理员上限约束，并重新计算表单总分和自动等级", () => {
  const saveBlock = between(service, "async function saveItemReviews", "async function submitObjection");
  assert.match(saveBlock, /Number\.isFinite\(reviewedScore\)/);
  assert.match(saveBlock, /reviewedScore\s*<\s*0/);
  assert.match(saveBlock, /reviewedScore\s*>\s*itemLimit/);
  assert.match(saveBlock, /normalizeFormItemsForLimits\(proposedItems, scoreLimits, \{ rejectOnExceed: true \}\)/);

  const reviewBlock = between(service, "async function reviewForm", "async function getStatistics");
  assert.match(reviewBlock, /UPDATE assessment_form_items SET score=\?/);
  assert.match(reviewBlock, /SELECT section, sub_key, score FROM assessment_form_items/);
  assert.match(reviewBlock, /recalculatedScores\s*=\s*calculateSmartFillScores\(scoreItems, settings\.scoreLimits\)/);
  assert.match(reviewBlock, /recalculatedLevel\s*=\s*calculateLevel\(recalculatedScores\.total, settings\.gradeRules\)/);
  assert.match(reviewBlock, /manual_level=''/);
});

test("手动修改等级接口和前端调用已移除，等级只由总分计算", () => {
  assert.doesNotMatch(routes, /forms\/:id\/level/);
  assert.doesNotMatch(module3ClientApi, /setFormLevel|forms\/\$\{id\}\/level/);
  assert.doesNotMatch(service, /async function setFormLevel/);

  const reviewBlock = between(service, "async function reviewForm", "async function getStatistics");
  assert.doesNotMatch(reviewBlock, /data\.level|manualLevel/);
  assert.match(reviewBlock, /calculateLevel\(recalculatedScores\.total, settings\.gradeRules\)/);
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
  assert.match(fillService, /WHERE batch_id = \?/);
  assert.match(fillService, /\[effectiveBatchId\]/);
  assert.match(fillService, /AND rmr\.rule_set_id = \?/);
  assert.match(fillService, /\[userId, ruleSetId\]/);
  assert.match(clientApi, /params:\s*batchId \? \{ batch_id: batchId \} : \{\}/);
  assert.match(smartFillView, /:batchId="currentBatch\?\.id"/);
  assert.match(smartFillForm, /batchId: \[Number, String\]/);
  assert.match(smartFillForm, /getFillPreview\(props\.batchId\)/);
  assert.match(smartFillForm, /saveFillData\(fillItems, props\.batchId\)/);
  assert.match(smartFillForm, /doFill\(templateId, props\.batchId\)/);
});
