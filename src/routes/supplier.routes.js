const express = require('express');
const supplierController = require('../controllers/supplier.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimiter.middleware');
const { validateSupplier } = require('../middleware/security.middleware');
const { validateObjectId } = require('../middleware/validateId.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Apply write limiter to write operations
router.post('/', writeLimiter, validateSupplier, supplierController.createSupplier);
router.get('/', supplierController.getSuppliers);
router.get('/:id', validateObjectId, supplierController.getSupplierById);
router.put('/:id', validateObjectId, writeLimiter, validateSupplier, supplierController.updateSupplier);
router.delete('/:id', validateObjectId, writeLimiter, supplierController.deleteSupplier);

module.exports = router;
