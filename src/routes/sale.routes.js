const express = require('express');
const ctrl = require('../controllers/sale.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimiter.middleware');
const { validateSale } = require('../middleware/security.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Regular sales
router.post('/', writeLimiter, validateSale, ctrl.createSale);
router.get('/', ctrl.getSales);

// Mix orders
router.post('/mix', writeLimiter, ctrl.createMixOrder);
router.get('/mix-orders', ctrl.getMixOrders);

module.exports = router;
