const express = require('express');
const customerController = require('../controllers/customer.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimiter.middleware');
const { validateCustomer } = require('../middleware/security.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Apply write limiter to write operations
router.post('/', writeLimiter, validateCustomer, customerController.createCustomer);
router.get('/', customerController.getCustomers);
router.get('/:id', customerController.getCustomerById);
router.put('/:id', writeLimiter, validateCustomer, customerController.updateCustomer);
router.delete('/:id', writeLimiter, customerController.deleteCustomer);

module.exports = router;