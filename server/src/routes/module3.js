const router = require("express").Router();
const ctrl = require("../controllers/module3Controller");
const auth = require("../middleware/auth");
const roleCheck = require("../middleware/roleCheck");
const upload = require("../middleware/upload");
const uploadOss = require("../middleware/uploadOss");

router.get("/batches", auth, ctrl.getBatches);
router.get("/student-batches", auth, roleCheck("student"), ctrl.getStudentBatches);
router.get("/student/forms/:batchId", auth, roleCheck("student"), ctrl.getStudentForm);
router.put("/student/forms/:batchId", auth, roleCheck("student"), ctrl.updateStudentForm);
router.post("/student/forms/:batchId/submit", auth, roleCheck("student"), ctrl.submitStudentForm);
router.post("/student/support-materials", auth, roleCheck("student"), uploadOss.array("files", 10), ctrl.uploadStudentSupportMaterials);
router.post("/batches", auth, roleCheck("admin"), ctrl.createBatch);
router.put("/batches/:id", auth, roleCheck("admin", "counselor"), ctrl.updateBatch);
router.put("/batches/:id/status", auth, roleCheck("admin"), ctrl.updateBatchStatus);
router.delete("/batches/:id", auth, roleCheck("admin"), ctrl.deleteBatch);

router.get("/score-policy", auth, ctrl.getScorePolicy);
router.get("/settings", auth, roleCheck("admin"), ctrl.getSettings);
router.put("/settings", auth, roleCheck("admin"), ctrl.updateSettings);

router.get("/scope-options", auth, roleCheck("admin", "counselor"), ctrl.getScopeOptions);
router.get("/students", auth, roleCheck("admin", "counselor"), ctrl.getStudents);
router.put("/counselor/scope", auth, roleCheck("counselor"), ctrl.updateCounselorScope);
router.put("/students/:id/member", auth, roleCheck("admin", "counselor"), ctrl.setAssessmentMember);

router.get("/materials", auth, ctrl.getMyMaterials);
router.get("/forms/:id", auth, roleCheck("student", "admin", "counselor", "student_affairs"), ctrl.getFormDetail);
router.get("/forms/:id/word-preview", auth, roleCheck("student", "admin", "counselor", "student_affairs"), ctrl.getFormWordPreview);
router.get("/forms/:id/word", auth, roleCheck("student", "admin", "counselor", "student_affairs"), ctrl.downloadFormWord);
router.put("/materials/:id/review", auth, roleCheck("student", "counselor", "student_affairs"), ctrl.reviewMaterial);
router.post("/forms/:id/objections", auth, roleCheck("student"), ctrl.submitObjection);
router.get("/pending", auth, roleCheck("student", "counselor", "student_affairs"), ctrl.getPendingReviews);

router.get("/statistics", auth, roleCheck("student", "admin", "counselor", "student_affairs"), ctrl.getStatistics);
router.post("/export", auth, roleCheck("admin", "student_affairs"), ctrl.exportExcel);
router.get("/logs", auth, roleCheck("admin", "student_affairs"), ctrl.getLogs);

router.get("/admin/users", auth, roleCheck("admin"), ctrl.adminListUsers);
router.post("/admin/accounts/student", auth, roleCheck("admin"), ctrl.adminCreateStudent);
router.post("/admin/accounts/student-import", auth, roleCheck("admin"), ctrl.adminImportStudents);
router.post("/admin/accounts/generate", auth, roleCheck("admin"), ctrl.adminGenerateAccounts);
router.put("/admin/accounts/reset-password", auth, roleCheck("admin"), ctrl.adminResetPassword);
router.delete("/admin/accounts/:id", auth, roleCheck("admin"), ctrl.adminDeleteUser);

router.get("/org", auth, roleCheck("admin", "counselor", "student", "student_affairs"), ctrl.getOrganizations);
router.post("/org/colleges", auth, roleCheck("admin"), ctrl.createCollege);
router.post("/org/majors", auth, roleCheck("admin"), ctrl.createMajor);
router.post("/org/classes", auth, roleCheck("admin"), ctrl.createClass);
router.delete("/org/colleges/:id", auth, roleCheck("admin"), ctrl.deleteCollege);
router.delete("/org/majors/:id", auth, roleCheck("admin"), ctrl.deleteMajor);
router.delete("/org/classes/:id", auth, roleCheck("admin"), ctrl.deleteClass);


module.exports = router;
