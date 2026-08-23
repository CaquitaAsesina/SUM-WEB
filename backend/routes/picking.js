const router = require('express').Router();
const controller = require('../controllers/pickingController');

router.get('/', controller.getAll);
router.get('/calcular', controller.calculate);
router.get('/calcular-area', controller.calculateForArea);
router.post('/', controller.create);
router.post('/batch', controller.createBatch);
router.put('/:id', controller.update);
router.delete('/:id', controller.delete);

module.exports = router;
