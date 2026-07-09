const router = require("express").Router();
const ctrl = require("../controllers/zongceController");
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");

// ===== 规则 =====
router.post("/rules/upload",  auth, upload.array("files", 10), ctrl.uploadRuleFiles);
router.post("/rules/text",    auth, ctrl.addRuleText);
router.get("/rules/sources",  auth, ctrl.getRuleSources);
router.get("/rules/items",    auth, ctrl.getRuleItems);
router.put("/rules/items/:id/toggle", auth, ctrl.toggleRuleItem);
router.delete("/rules/sources/:id",   auth, ctrl.deleteRuleSource);
router.delete("/rules/items/:id",     auth, ctrl.deleteRuleItem);

// ===== 材料 =====
router.post("/materials",                      auth, ctrl.createMaterial);
router.get("/materials",                       auth, ctrl.getMaterials);
router.post("/materials/:id/upload",           auth, upload.array("files", 10), ctrl.uploadAttachments);
router.post("/materials/:id/analyze",          auth, ctrl.analyzeMaterial);
router.delete("/materials/:id",                auth, ctrl.deleteMaterial);
router.delete("/materials/:matId/attachments/:attId", auth, ctrl.deleteAttachment);

// ===== 识别结果 =====
router.put("/recognitions/:id/confirm",  auth, ctrl.confirmRecognition);
router.put("/recognitions/:id/dismiss",  auth, ctrl.dismissRecognition);

// ===== 评分 =====
router.post("/evaluation/calculate", auth, ctrl.calculateScore);
router.get("/evaluation/result",    auth, ctrl.getEvaluation);

// ===== 模板与填表 =====
router.post("/templates/upload",        auth, upload.single("file"), ctrl.uploadTemplate);
router.get("/templates",               auth, ctrl.getTemplates);
router.post("/fill/:templateId",       auth, ctrl.doFill);
router.get("/fill/:id/download",       auth, ctrl.downloadFill);

module.exports = router;
