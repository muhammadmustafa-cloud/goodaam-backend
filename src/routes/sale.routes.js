const express = require('express');
const ctrl = require('../controllers/sale.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimiter.middleware');
const { validateSale } = require('../middleware/security.middleware');
const { validateObjectId } = require('../middleware/validateId.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Regular sales
router.post('/', writeLimiter, validateSale, ctrl.createSale);
router.get('/', ctrl.getSales);

// Mix orders
router.post('/mix', writeLimiter, ctrl.createMixOrder);
router.get('/mix-orders', ctrl.getMixOrders);

router.get('/:id', validateObjectId, ctrl.getSaleById);
router.put('/:id', validateObjectId, writeLimiter, validateSale, ctrl.updateSale);

module.exports = router;
