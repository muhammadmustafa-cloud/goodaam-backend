const express = require('express');
const router = express.Router();
const financialController = require('../controllers/financial.controller');

// Financial balance routes
router.get('/balances', financialController.getFinancialBalances);
router.get('/summary', financialController.getBalanceSummary);
router.get('/history', financialController.getBalanceHistory);
router.post('/update', financialController.updateFinancialBalance);

module.exports = router;
