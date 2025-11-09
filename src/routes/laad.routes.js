const express = require('express');
const laadController = require('../controllers/laad.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimiter.middleware');
const { validateLaad } = require('../middleware/security.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Apply write limiter to write operations
router.post('/', writeLimiter, validateLaad, laadController.createLaad);
router.get('/', laadController.getLaads);
router.get('/:id', laadController.getLaadById);

module.exports = router;
