const express = require('express');
const router = express.Router();
const financialController = require('../controllers/financial.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimiter.middleware');

// All routes require authentication
router.use(authenticate);

// Financial balance routes
router.get('/balances', financialController.getFinancialBalances);
router.get('/summary', financialController.getBalanceSummary);
router.get('/history', financialController.getBalanceHistory);
router.post('/update', writeLimiter, financialController.updateFinancialBalance);

module.exports = router;
