const express = require('express');
const ctrl = require('../controllers/sale.controller');

const router = express.Router();

// Regular sales
router.post('/', ctrl.createSale);
router.get('/', ctrl.getSales);

// Mix orders
router.post('/mix-order', ctrl.createMixOrder);
router.get('/mix-orders', ctrl.getMixOrders);

module.exports = router;
