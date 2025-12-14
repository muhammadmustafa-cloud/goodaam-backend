const express = require('express');
const truckArrivalEntryController = require('../controllers/truckArrivalEntry.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimiter.middleware');
const { validateObjectId } = require('../middleware/validateId.middleware');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// Apply write limiter to write operations
router.put('/:id', validateObjectId, writeLimiter, truckArrivalEntryController.updateTruckArrivalEntry);
router.delete('/:id', validateObjectId, writeLimiter, truckArrivalEntryController.deleteTruckArrivalEntry);
router.get('/', truckArrivalEntryController.getTruckArrivalEntries);
router.get('/:id', validateObjectId, truckArrivalEntryController.getTruckArrivalEntryById);

module.exports = router;

