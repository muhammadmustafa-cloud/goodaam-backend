const express = require('express');
const stockController = require('../controllers/stock.controller');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Get combined stock items
router.get('/combined', stockController.getCombinedStockItems);

module.exports = router;

