const router = require('express').Router();
const controller = require('../controllers/periodosController');

router.get('/', controller.getAll);
router.get('/activo', controller.getActive);
router.get('/:id', controller.getById);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.put('/:id/cerrar', controller.close);
router.delete('/:id', controller.delete);

module.exports = router;
