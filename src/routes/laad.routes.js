const express = require('express');
const laadController = require('../controllers/laad.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimiter.middleware');
const { validateLaad } = require('../middleware/security.middleware');
const { validateObjectId } = require('../middleware/validateId.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Apply write limiter to write operations
router.post('/', writeLimiter, validateLaad, laadController.createLaad);
router.put('/:id', validateObjectId, writeLimiter, validateLaad, laadController.updateLaad);
router.delete('/:id', validateObjectId, writeLimiter, laadController.deleteLaad);
router.get('/', laadController.getLaads);
router.get('/by-number/:laadNumber', laadController.getLaadByLaadNumber);
router.get('/:id', validateObjectId, laadController.getLaadById);

module.exports = router;
