const express = require('express');
const itemController = require('../controllers/item.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimiter.middleware');
const { validateItem } = require('../middleware/security.middleware');
const { validateObjectId } = require('../middleware/validateId.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

router.post('/', writeLimiter, validateItem, itemController.createItem);
router.get('/stock-summary', itemController.getItemStockSummary);
router.get('/', itemController.getItems);
router.put('/:id', writeLimiter, validateItem, itemController.updateItem);
router.delete('/:id', itemController.deleteItem);

module.exports = router;
