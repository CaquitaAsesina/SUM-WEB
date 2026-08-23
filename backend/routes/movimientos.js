const router = require('express').Router();
const controller = require('../controllers/movimientosController');
const { requireActivePeriod } = require('../middleware/periodoMiddleware');

router.get('/', controller.getAll);
router.post('/', requireActivePeriod, controller.create);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

module.exports = router;
