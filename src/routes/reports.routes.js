const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports.controller');

// Customer ledger
router.get('/customers/ledger', reportsController.getAllCustomersLedger);
router.get('/customers/:customerId/ledger', reportsController.getCustomerLedger);

// Supplier ledger
router.get('/suppliers/ledger', reportsController.getAllSuppliersLedger);
router.get('/suppliers/:supplierId/ledger', reportsController.getSupplierLedger);

// Daily sales report
router.get('/sales/daily', reportsController.getDailySalesReport);

// Stock movement
router.get('/stock/movement', reportsController.getStockMovement);

module.exports = router;


