const router = require('express').Router();
const controller = require('../controllers/authController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

router.post('/login', controller.login);
router.get('/me', authenticate, controller.me);
router.get('/users', authenticate, requireAdmin, controller.getAllUsers);

module.exports = router;
