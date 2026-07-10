const router = require("express").Router();
const ctrl = require("../controllers/module3Controller");
const auth = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");

router.get("/batches", auth, ctrl.getBatches);
router.post("/batches", auth, roleCheck("admin"), ctrl.createBatch);
router.put("/batches/:id/status", auth, roleCheck("admin"), ctrl.updateBatchStatus);

router.get("/settings", auth, roleCheck("admin"), ctrl.getSettings);
router.put("/settings", auth, roleCheck("admin"), ctrl.updateSettings);

router.get("/materials", auth, ctrl.getMyMaterials);
router.get("/forms/:id", auth, roleCheck("admin", "class_committee", "counselor", "student_affairs"), ctrl.getFormDetail);
router.put("/forms/:id/level", auth, roleCheck("class_committee", "counselor", "student_affairs"), ctrl.setFormLevel);

router.put("/materials/:id/review", auth, roleCheck("class_committee", "counselor", "student_affairs"), ctrl.reviewMaterial);
router.get("/pending", auth, roleCheck("class_committee", "counselor", "student_affairs"), ctrl.getPendingReviews);

router.get("/statistics", auth, roleCheck("admin", "class_committee", "counselor", "student_affairs"), ctrl.getStatistics);
router.post("/export", auth, roleCheck("admin", "student_affairs"), ctrl.exportExcel);
router.get("/logs", auth, roleCheck("admin", "student_affairs"), ctrl.getLogs);

module.exports = router;
