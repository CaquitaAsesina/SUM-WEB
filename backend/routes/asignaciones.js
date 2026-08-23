const router = require('express').Router();
const controller = require('../controllers/asignacionesController');

router.get('/', controller.getAll);
router.get('/area/:areaId', controller.getByArea);
router.post('/', controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

module.exports = router;
