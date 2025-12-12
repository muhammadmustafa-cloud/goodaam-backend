const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { validateObjectId } = require('../middleware/validateId.middleware');

// All routes require authentication
router.use(authenticate);

// Customer ledger
router.get('/customers/ledger', reportsController.getAllCustomersLedger);
router.get('/customers/:customerId/ledger', validateObjectId, reportsController.getCustomerLedger);

// Supplier ledger
router.get('/suppliers/ledger', reportsController.getAllSuppliersLedger);
router.get('/suppliers/:supplierId/ledger', validateObjectId, reportsController.getSupplierLedger);

// Daily sales report
router.get('/sales/daily', reportsController.getDailySalesReport);

// Stock movement
router.get('/stock/movement', reportsController.getStockMovement);

// Laad report
router.get('/laad/:laadNumber', reportsController.getLaadReport);

// Item report
router.get('/item/:itemId', reportsController.getItemReport);

module.exports = router;


