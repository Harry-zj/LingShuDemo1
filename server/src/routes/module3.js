const router = require('express').Router();
const ctrl = require('../controllers/module3Controller');
const auth = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

router.get('/batches', auth, ctrl.getBatches);
router.post('/batches', auth, roleCheck('teacher'), ctrl.createBatch);
router.put('/batches/:id', auth, roleCheck('teacher'), ctrl.updateBatch);
router.put('/batches/:id/status', auth, roleCheck('teacher'), ctrl.updateBatchStatus);

router.get('/materials', auth, ctrl.getMyMaterials);
router.put('/materials/:id/review', auth, roleCheck('class_leader', 'teacher'), ctrl.reviewMaterial);
router.get('/pending', auth, roleCheck('class_leader', 'teacher'), ctrl.getPendingReviews);
router.get('/statistics', auth, roleCheck('class_leader', 'teacher'), ctrl.getStatistics);
router.post('/export', auth, roleCheck('teacher'), ctrl.exportExcel);

router.get('/classes', auth, roleCheck('teacher'), ctrl.getClasses);
router.get('/users', auth, roleCheck('teacher'), ctrl.getUsers);
router.put('/classes/:id/leader', auth, roleCheck('teacher'), ctrl.setClassLeader);
router.get('/notifications', auth, ctrl.getNotifications);
router.get('/logs', auth, roleCheck('teacher'), ctrl.getLogs);

module.exports = router;
