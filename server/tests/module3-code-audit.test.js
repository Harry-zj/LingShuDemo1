"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  servicePath,
  controllerPath,
  routesPath,
  appPath,
  read,
  between,
} = require("./module3-test-helpers");

const service = read(servicePath);
const controller = read(controllerPath);
const routes = read(routesPath);
const app = read(appPath);

test("[诊断] 智能填表来源必须按所选批次隔离", () => {
  const block = between(service, "async function getLatestSmartFillSource", "async function getWordDocumentMetadata");
  assert.match(block, /batchId|batch_id/, "当前实现只按学生取最新结果，可能把其他批次/学年的数据导入当前批次");
});

test("[诊断] 学生批次列表不应暴露草稿批次", () => {
  const block = between(service, "async function listBatches", "async function listStudentBatches");
  const studentStart = block.indexOf('user.role === "student"');
  const counselorStart = block.indexOf('user.role === "counselor"');
  const studentBranch = block.slice(studentStart, counselorStart);
  assert.match(studentBranch, /status/, "学生分支当前只按学院和年级筛选，会显示管理员草稿批次");
});

test("[诊断] 批次开始时间、结束时间或全局截止时间必须在服务端生效", () => {
  const block = between(service, "function canStudentEdit", "function readonlyReason");
  assert.match(block, /start_time|end_time|submitDeadline|Date\.now/, "当前编辑/提交权限完全未检查时间范围");
});

test("[诊断] 评价人员填写的复核分值必须更新最终分数", () => {
  const block = between(service, "async function reviewForm", "async function getStatistics");
  assert.match(
    block,
    /UPDATE\s+assessment_form_items[\s\S]{0,300}(?:score|reviewed_score)|UPDATE\s+assessment_forms[\s\S]{0,300}scores=/i,
    "当前只把 reviewed_score 写入评价记录，表单项目分值、总分和等级均不会变化"
  );
});

test("[诊断] 学生保存退回表单时必须处理旧逐项评价引用", () => {
  const block = between(service, "async function updateSmartResult", "async function selectWorkflowReviewer");
  const deleteItemsAt = block.indexOf("DELETE FROM assessment_form_items");
  assert.ok(deleteItemsAt >= 0, "未找到表单项目替换逻辑");
  const beforeDelete = block.slice(0, deleteItemsAt);
  assert.match(
    beforeDelete,
    /assessment_item_reviews|UPDATE\s+assessment_form_items/i,
    "当前先删掉全部项目并重新插入，旧评价记录仍引用已删除的 item_id，退回理由会从新项目上消失"
  );
});

test("[诊断] 辅导员获取范围选项时必须按当前账号过滤", () => {
  const block = between(controller, "exports.getScopeOptions", "exports.getStatistics");
  assert.match(block, /currentUser\(req\)/, "当前控制器未把当前辅导员传给服务层，会返回全部学生、班级和成员关系");
});

test("[诊断] 单独修改等级接口不得允许学生修改自己的结果", () => {
  const routeLine = routes.split(/\r?\n/).find(line => line.includes('/forms/:id/level')) || "";
  assert.doesNotMatch(routeLine, /roleCheck\([^)]*"student"/, "当前路由允许学生调用等级修改接口");
  const block = between(service, "async function setFormLevel", "async function reviewForm");
  assert.match(block, /stage=.*pending|assessment_review_tasks[\s\S]*status='pending'/, "当前服务层也未要求操作者持有该表单的待评任务");
});

test("[诊断] 统计中的学生总数必须使用同一批次和同一权限范围", () => {
  const block = between(service, "async function getStatistics", "function emptyStatistics");
  assert.doesNotMatch(
    block,
    /SELECT COUNT\(\*\) AS count FROM users WHERE role='student'/,
    "当前 total_students 是全校学生数，与批次筛选或辅导员范围无关"
  );
});

test("[诊断] 学生提交的分值必须校验为有限且非负的合理数值", () => {
  const block = between(service, "async function updateSmartResult", "async function selectWorkflowReviewer");
  assert.match(block, /Number\.isFinite/, "当前 Number(input.score) 后没有有限数校验");
  assert.match(block, /score\s*<\s*0|Math\.max\(0|不得为负|分值范围/, "当前允许负数或异常大分值进入总分计算");
});

test("[诊断] 创建和修改批次时必须校验结束时间不早于开始时间", () => {
  const createBlock = between(service, "async function createBatch", "async function updateBatch");
  const updateBlock = between(service, "async function updateBatch", "async function updateBatchStatus");
  const dateValidation = /new Date\([^)]*end_time[^)]*\)\s*<\s*new Date\([^)]*start_time[^)]*\)|endTime\s*<\s*startTime|结束时间.{0,20}早于/;
  assert.match(`${createBlock}\n${updateBlock}`, dateValidation, "当前前后端都只检查日期是否填写，不检查先后顺序");
});

test("[诊断] 上传类型或大小错误应返回统一 JSON", () => {
  assert.match(app, /app\.use\s*\(\s*\(err\s*,\s*req\s*,\s*res\s*,\s*next\)/, "当前没有 Express 错误处理中间件，Multer 错误可能返回 HTML 500");
});
