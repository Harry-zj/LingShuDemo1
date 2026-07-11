const router = require("express").Router();
const auth = require("../middleware/devAuth");  // 开发模式，正式上线改回 ../middleware/auth
const upload = require("../middleware/upload");

const ruleCtrl = require("../controllers/zongce/ruleController");
const ruleSetCtrl = require("../controllers/zongce/ruleSetController");
const materialCtrl = require("../controllers/zongce/materialController");
const recogCtrl = require("../controllers/zongce/recognitionController");
const evalCtrl = require("../controllers/zongce/evaluationController");
const fillCtrl = require("../controllers/zongce/fillController");

// ===== 规则 =====
router.post("/rules/upload",   auth, upload.array("files", 10), ruleCtrl.uploadRuleFiles);
router.post("/rules/text",     auth, ruleCtrl.addRuleText);
router.get("/rules/sources",   auth, ruleCtrl.getRuleSources);
router.post("/rules/sources/:id/parse", auth, ruleCtrl.parseRuleSource);
router.get("/rules/tasks/:taskId", auth, ruleCtrl.getParseProgress);
router.get("/rules/tasks/:taskId/stream", auth, ruleCtrl.streamParseProgress);
router.delete("/rules/sources/:id",   auth, ruleCtrl.deleteRuleSource);

// ===== 材料 =====
router.post("/materials",                      auth, materialCtrl.createMaterial);
router.get("/materials",                       auth, materialCtrl.getMaterials);
router.post("/materials/:id/upload",           auth, upload.array("files", 10), materialCtrl.uploadAttachments);
router.post("/materials/:id/analyze",          auth, materialCtrl.analyzeMaterial);
router.post("/materials/:id/extract",         auth, materialCtrl.extractMaterial);
router.post("/materials/:id/preview",         auth, materialCtrl.previewScore);
router.post("/materials/:id/match",           auth, materialCtrl.matchMaterial);
router.delete("/materials/:id",                auth, materialCtrl.deleteMaterial);
router.delete("/materials/:matId/attachments/:attId", auth, materialCtrl.deleteAttachment);

// ===== 识别结果 =====
router.put("/recognitions/:id/confirm", auth, recogCtrl.confirmRecognition);
router.put("/recognitions/:id/dismiss", auth, recogCtrl.dismissRecognition);

// ===== 评分 =====
router.post("/evaluation/calculate", auth, evalCtrl.calculateScore);
router.get("/evaluation/result",     auth, evalCtrl.getEvaluation);
router.get("/calculations/:id",      auth, evalCtrl.getCalculation);
router.post("/calculations/:id/resume", auth, evalCtrl.resumeCalculation);

// ===== 规则集 =====
router.post("/rule-sets", auth, ruleSetCtrl.createRuleSet);
router.get("/rule-sets", auth, ruleSetCtrl.getRuleSets);
router.get("/rule-sets/:id", auth, ruleSetCtrl.getRuleSet);
router.post("/rule-sets/:id/documents", auth, ruleSetCtrl.addDocument);
router.delete("/rule-sets/:id/documents/:docId", auth, ruleSetCtrl.removeDocument);
router.post("/rule-sets/:id/publish", auth, ruleSetCtrl.publishRuleSet);
router.delete("/rule-sets/:id", auth, ruleSetCtrl.deleteRuleSet);
router.post("/rule-sets/:id/clone", auth, ruleSetCtrl.cloneRuleSet);

// ===== 模板与填表 =====
router.post("/templates/upload",  auth, upload.single("file"), fillCtrl.uploadTemplate);
router.get("/templates",         auth, fillCtrl.getTemplates);
router.post("/fill/:templateId", auth, fillCtrl.doFill);
router.get("/fill/:id/download", auth, fillCtrl.downloadFill);

module.exports = router;
