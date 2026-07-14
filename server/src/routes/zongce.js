const router = require("express").Router();
const auth = require("../middleware/auth");  // 开发模式，正式上线改回 ../middleware/auth
const upload = require("../middleware/upload");
const { pool } = require("../config/database");
const Res = require("../utils/response");


const ruleCtrl = require("../controllers/zongce/ruleController");
const ruleSetCtrl = require("../controllers/zongce/ruleSetController");
const materialCtrl = require("../controllers/zongce/materialController");
const recogCtrl = require("../controllers/zongce/recognitionController");
const evalCtrl = require("../controllers/zongce/evaluationController");
const fillCtrl = require("../controllers/zongce/fillController");
const batchFillCtrl = require("../controllers/zongce/batchFillController");
const chatFillCtrl = require("../controllers/zongce/chatFillController");
const uploadOss = require("../middleware/uploadOss");

// ===== 规则 =====
router.post("/rules/upload",   auth, upload.array("files", 10), ruleCtrl.uploadRuleFiles);
router.post("/rules/text",     auth, ruleCtrl.addRuleText);
router.get("/rules/sources",   auth, ruleCtrl.getRuleSources);
router.get("/rules/published", auth, ruleSetCtrl.getPublishedRules);
router.post("/rules/sources/:id/parse", auth, ruleCtrl.parseRuleSource);
router.get("/rules/tasks/:taskId", auth, ruleCtrl.getParseProgress);
router.get("/rules/tasks/:taskId/stream", auth, ruleCtrl.streamParseProgress);
router.delete("/rules/sources/:id",   auth, ruleCtrl.deleteRuleSource);

// ===== 材料 =====
router.post("/materials",                      auth, materialCtrl.createMaterial);
router.get("/materials",                       auth, materialCtrl.getMaterials);
router.post("/materials/:id/upload",           auth, uploadOss.array("files", 10), materialCtrl.uploadAttachments);
router.post("/materials/:id/analyze",          auth, materialCtrl.analyzeMaterial);
router.post("/materials/:id/extract",         auth, materialCtrl.extractMaterial);
router.post("/materials/:id/preview",         auth, materialCtrl.previewScore);
router.post("/materials/:id/match",           auth, materialCtrl.matchMaterial);
router.delete("/materials/:id",                auth, materialCtrl.deleteMaterial);
router.delete("/materials/:matId/attachments/:attId", auth, materialCtrl.deleteAttachment);

// ===== 识别结果 =====
router.put("/recognitions/:id/confirm", auth, recogCtrl.confirmRecognition);
router.put("/recognitions/:id/dismiss", auth, recogCtrl.dismissRecognition);
router.put("/recognitions/fact-match/:id/confirm", auth, recogCtrl.confirmFactMatch);

router.post("/materials/:id/confirm-match", auth, materialCtrl.confirmMatchV3);
router.post("/materials/:id/generate-description", auth, materialCtrl.generateMatchDescription);

// ===== 评分 =====
router.post("/evaluation/calculate", auth, evalCtrl.calculateScore);
router.get("/evaluation/score-list", auth, evalCtrl.getScoreList);
router.post("/evaluation/save-result", auth, evalCtrl.saveResult);
router.get("/evaluation/result",     auth, evalCtrl.getEvaluation);
router.get("/calculations/:id",      auth, evalCtrl.getCalculation);
router.post("/calculations/:id/resume", auth, evalCtrl.resumeCalculation);

// ===== 规则�?=====
router.post("/rule-sets", auth, ruleSetCtrl.createRuleSet);
router.get("/rule-sets", auth, ruleSetCtrl.getRuleSets);
router.get("/rule-sets/:id", auth, ruleSetCtrl.getRuleSet);
router.post("/rule-sets/:id/documents", auth, ruleSetCtrl.addDocument);
router.delete("/rule-sets/:id/documents/:docId", auth, ruleSetCtrl.removeDocument);
router.post("/rule-sets/:id/publish", auth, ruleSetCtrl.publishRuleSet);
router.post("/rule-sets/:id/rules", auth, ruleSetCtrl.addRule);
router.delete("/rule-sets/:id", auth, ruleSetCtrl.deleteRuleSet);
router.post("/rule-sets/:id/clone", auth, ruleSetCtrl.cloneRuleSet);

// ===== 模板与填�?=====
router.post("/templates/upload",  auth, upload.single("file"), fillCtrl.uploadTemplate);
router.get("/templates",         auth, fillCtrl.getTemplates);
router.delete("/templates/:id",  auth, fillCtrl.deleteTemplate);
router.post("/fill/:templateId", auth, fillCtrl.doFill);
router.get("/fill/:id/download", auth, fillCtrl.downloadFill);
router.get("/fill-preview",         auth, fillCtrl.getFillPreview);
// ===== 智能填表数据 =====
router.post("/smart-fill/save",        auth, fillCtrl.saveFillData);
router.get("/smart-fill/data",         auth, fillCtrl.getSmartFillData);
router.post("/smart-fill/generate-f1", auth, fillCtrl.generateF1Descriptions);




// ===== 批量填表 =====
router.post("/batch-fill/upload", auth, upload.fields([
  { name: "excel", maxCount: 1 },
  { name: "template", maxCount: 1 },
]), batchFillCtrl.uploadFiles);
router.put("/batch-fill/mapping",  auth, batchFillCtrl.updateMapping);
router.post("/batch-fill/execute/:taskId", auth, batchFillCtrl.executeBatchFill);
router.get("/batch-fill/:id/download",     batchFillCtrl.downloadResult);

// ===== 对话式填�?=====
router.post("/chat-fill/upload",      auth, upload.single("file"), chatFillCtrl.uploadTemplate);
router.post("/chat-fill/analyze/:templateId", auth, chatFillCtrl.analyzeTemplate);
router.post("/chat-fill/chat",        auth, chatFillCtrl.chatField);
router.post("/chat-fill/fill",        auth, chatFillCtrl.doFill);


// ===== 测评批次（智能填表模块使用） =====
router.post("/rules/parse/:taskId/cancel", auth, ruleCtrl.cancelParse);

// ★ 获取批次列表（学生按 college+grade 过滤，管理员看全部）
router.get("/batches", auth, async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'admin' || req.user.role === 'student_affairs') {
      [rows] = await pool.execute(
        `SELECT id, school_year, title, college, grade, status, start_time, end_time
         FROM assessment_batches WHERE status <> 'deleted' ORDER BY school_year DESC`
      );
    } else {
      const [[user]] = await pool.execute("SELECT college, grade FROM users WHERE id = ?", [req.user.id]);
      if (!user) return res.json(Res.error("用户不存在"));
      [rows] = await pool.execute(
        `SELECT id, school_year, title, college, grade, status, start_time, end_time
         FROM assessment_batches WHERE status <> 'deleted' AND college = ? AND grade = ?
         ORDER BY school_year DESC`,
        [user.college || '', user.grade || '']
      );
    }
    res.json(Res.success(rows));
  } catch (e) { res.json(Res.error(e.message)); }
});

// ★ 自动匹配学生当前批次（最新学年）
router.get("/student-batch", auth, async (req, res) => {
  try {
    const [[user]] = await pool.execute("SELECT college, grade FROM users WHERE id = ?", [req.user.id]);
    if (!user) return res.json(Res.error("用户不存在"));
    const [rows] = await pool.execute(
      `SELECT id, school_year, title, college, grade, status, start_time, end_time
       FROM assessment_batches
       WHERE college = ? AND grade = ? AND status <> 'deleted'
       ORDER BY school_year DESC LIMIT 1`,
      [user.college || '', user.grade || '']
    );
    if (!rows.length) return res.json(Res.error("未找到匹配的测评批次，请联系管理员创建您所在学院和年级的批次"));
    res.json(Res.success(rows[0]));
  } catch (e) { res.json(Res.error(e.message)); }
});

// ===== 规则批次迁移（切批次时实时更新） =====
router.put("/rules/move-batch", auth, async (req, res) => {
  try {
    const { from_batch_id, to_batch_id } = req.body;
    if (!from_batch_id || !to_batch_id) return res.json(Res.error("缺少批次参数"));
    if (from_batch_id == to_batch_id) return res.json(Res.success(null, "无需迁移"));

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      // 更新 rule_sources 的 batch_id
      await conn.execute(
        "UPDATE rule_sources SET batch_id = ? WHERE user_id = ? AND batch_id = ?",
        [to_batch_id, req.user.id, from_batch_id]
      );
      // 更新 rule_sets 的 batch_id
      await conn.execute(
        "UPDATE rule_sets SET batch_id = ? WHERE user_id = ? AND batch_id = ?",
        [to_batch_id, req.user.id, from_batch_id]
      );
      // 更新 scoring_rules 的 batch_id
      await conn.execute(
        "UPDATE scoring_rules SET batch_id = ? WHERE user_id = ? AND batch_id = ?",
        [to_batch_id, req.user.id, from_batch_id]
      );
      await conn.commit();
      res.json(Res.success(null, "规则已迁至新批次"));
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally { conn.release(); }
  } catch (e) { res.json(Res.error(e.message)); }
});


module.exports = router;
