const router = require("express").Router();
const ctrl = require("../controllers/module3Controller");
const auth = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");

router.get("/batches", auth, ctrl.getBatches);
router.get("/student-batches", auth, roleCheck("student"), ctrl.getStudentBatches);
router.post("/batches", auth, roleCheck("admin"), ctrl.createBatch);
router.put("/batches/:id", auth, roleCheck("admin", "counselor"), ctrl.updateBatch);
router.put("/batches/:id/status", auth, roleCheck("admin"), ctrl.updateBatchStatus);
router.delete("/batches/:id", auth, roleCheck("admin"), ctrl.deleteBatch);

router.get("/settings", auth, roleCheck("admin"), ctrl.getSettings);
router.put("/settings", auth, roleCheck("admin"), ctrl.updateSettings);
router.get("/scope-options", auth, roleCheck("admin", "counselor"), ctrl.getScopeOptions);

router.get("/materials", auth, ctrl.getMyMaterials);
router.get("/forms/:id", auth, ctrl.getFormDetail);
router.put("/forms/:id/level", auth, ctrl.setFormLevel);

router.put("/materials/:id/review", auth, ctrl.reviewMaterial);
router.get("/pending", auth, ctrl.getPendingReviews);

router.get("/students", auth, roleCheck("admin", "counselor"), ctrl.getStudents);
router.put("/counselor/scope", auth, roleCheck("counselor"), ctrl.updateCounselorScope);
router.put("/students/:id/member", auth, roleCheck("admin", "counselor"), ctrl.setAssessmentMember);
router.post("/temp-users", auth, roleCheck("admin"), ctrl.createTemporaryUser);

router.get("/statistics", auth, roleCheck("admin", "counselor", "student_affairs"), ctrl.getStatistics);
router.post("/export", auth, roleCheck("admin", "student_affairs", "counselor"), ctrl.exportExcel);
router.get("/logs", auth, roleCheck("admin", "student_affairs"), ctrl.getLogs);

module.exports = router;
