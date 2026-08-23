const router = require('express').Router();
const controller = require('../controllers/auditoriasController');

router.get('/', controller.getAll);
router.get('/formulario', controller.getAuditForm);
router.post('/', controller.create);
router.post('/single', controller.createSingle);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

module.exports = router;
