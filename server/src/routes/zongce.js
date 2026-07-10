const router = require("express").Router();
const auth = require("../middleware/devAuth");  // 开发模式，正式上线改回 ../middleware/auth
const upload = require("../middleware/upload");

const ruleCtrl = require("../controllers/zongce/ruleController");
const materialCtrl = require("../controllers/zongce/materialController");
const recogCtrl = require("../controllers/zongce/recognitionController");
const evalCtrl = require("../controllers/zongce/evaluationController");
const fillCtrl = require("../controllers/zongce/fillController");
const batchFillCtrl = require("../controllers/zongce/batchFillController");
const chatFillCtrl = require("../controllers/zongce/chatFillController");

// ===== 规则 =====
router.post("/rules/upload",   auth, upload.array("files", 10), ruleCtrl.uploadRuleFiles);
router.post("/rules/text",     auth, ruleCtrl.addRuleText);
router.get("/rules/sources",   auth, ruleCtrl.getRuleSources);
router.get("/rules/items",     auth, ruleCtrl.getRuleItems);
router.put("/rules/items/:id/toggle", auth, ruleCtrl.toggleRuleItem);
router.post("/rules/sources/:id/parse", auth, ruleCtrl.parseRuleSource);
router.get("/rules/tasks/:taskId", auth, ruleCtrl.getParseProgress);
router.get("/rules/tasks/:taskId/stream", auth, ruleCtrl.streamParseProgress);
router.delete("/rules/sources/:id",   auth, ruleCtrl.deleteRuleSource);
router.delete("/rules/items/:id",     auth, ruleCtrl.deleteRuleItem);

// ===== 材料 =====
router.post("/materials",                      auth, materialCtrl.createMaterial);
router.get("/materials",                       auth, materialCtrl.getMaterials);
router.post("/materials/:id/upload",           auth, upload.array("files", 10), materialCtrl.uploadAttachments);
router.post("/materials/:id/analyze",          auth, materialCtrl.analyzeMaterial);
router.delete("/materials/:id",                auth, materialCtrl.deleteMaterial);
router.delete("/materials/:matId/attachments/:attId", auth, materialCtrl.deleteAttachment);

// ===== 识别结果 =====
router.put("/recognitions/:id/confirm", auth, recogCtrl.confirmRecognition);
router.put("/recognitions/:id/dismiss", auth, recogCtrl.dismissRecognition);

// ===== 评分 =====
router.post("/evaluation/calculate", auth, evalCtrl.calculateScore);
router.get("/evaluation/result",     auth, evalCtrl.getEvaluation);

// ===== 模板与填表 =====
router.post("/templates/upload",  auth, upload.single("file"), fillCtrl.uploadTemplate);
router.get("/templates",         auth, fillCtrl.getTemplates);
router.post("/fill/:templateId", auth, fillCtrl.doFill);
router.get("/fill/:id/download", auth, fillCtrl.downloadFill);
router.get("/mock-data",         auth, fillCtrl.getMockData);



// ===== 批量填表 =====
router.post("/batch-fill/upload", auth, upload.fields([
  { name: "excel", maxCount: 1 },
  { name: "template", maxCount: 1 },
]), batchFillCtrl.uploadFiles);
router.put("/batch-fill/mapping",  auth, batchFillCtrl.updateMapping);
router.post("/batch-fill/execute/:taskId", auth, batchFillCtrl.executeBatchFill);
router.get("/batch-fill/:id/download",     batchFillCtrl.downloadResult);

// ===== 对话式填表 =====
router.post("/chat-fill/upload",      auth, upload.single("file"), chatFillCtrl.uploadTemplate);
router.post("/chat-fill/analyze/:templateId", auth, chatFillCtrl.analyzeTemplate);
router.post("/chat-fill/chat",        auth, chatFillCtrl.chatField);
router.post("/chat-fill/fill",        auth, chatFillCtrl.doFill);

module.exports = router;
