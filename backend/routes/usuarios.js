const router = require('express').Router();
const controller = require('../controllers/usuariosController');
const { authenticate, requireAdmin } = require('../middleware/authMiddleware');

router.get('/', authenticate, requireAdmin, controller.getAll);
router.get('/:id', authenticate, requireAdmin, controller.getById);
router.post('/', authenticate, requireAdmin, controller.create);
router.put('/:id', authenticate, requireAdmin, controller.update);
router.put('/change-password/me', authenticate, controller.changePassword);
router.delete('/:id', authenticate, requireAdmin, controller.delete);

module.exports = router;
