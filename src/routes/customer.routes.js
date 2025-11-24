const express = require('express');
const customerController = require('../controllers/customer.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimiter.middleware');
const { validateCustomer } = require('../middleware/security.middleware');
const { validateObjectId } = require('../middleware/validateId.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Apply write limiter to write operations
router.post('/', writeLimiter, validateCustomer, customerController.createCustomer);
router.get('/', customerController.getCustomers);
router.get('/:id', validateObjectId, customerController.getCustomerById);
router.put('/:id', validateObjectId, writeLimiter, validateCustomer, customerController.updateCustomer);
router.delete('/:id', validateObjectId, writeLimiter, customerController.deleteCustomer);

module.exports = router;