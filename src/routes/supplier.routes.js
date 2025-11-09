const express = require('express');
const supplierController = require('../controllers/supplier.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimiter.middleware');
const { validateSupplier } = require('../middleware/security.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Apply write limiter to write operations
router.post('/', writeLimiter, validateSupplier, supplierController.createSupplier);
router.get('/', supplierController.getSuppliers);
router.get('/:id', supplierController.getSupplierById);
router.put('/:id', writeLimiter, validateSupplier, supplierController.updateSupplier);
router.delete('/:id', writeLimiter, supplierController.deleteSupplier);

module.exports = router;
