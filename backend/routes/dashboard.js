const router = require('express').Router();
const controller = require('../controllers/dashboardController');

router.get('/', controller.getSummary);
router.get('/area-status', controller.getAreaStatus);
router.get('/compliance', controller.getComplianceData);
router.get('/movements', controller.getMovementsSummary);

module.exports = router;
