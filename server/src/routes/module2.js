const router = require("express").Router();
const ctrl = require("../controllers/module2Controller");
const auth = require("../middleware/auth");
router.get("/evaluation", auth, ctrl.getEvaluation);
router.post("/report", auth, ctrl.generateReport);
router.get("/class-stats", auth, ctrl.getClassStats);
router.get("/advice", auth, ctrl.getAdvice);
router.get("/history", auth, ctrl.getHistory);
module.exports = router;
