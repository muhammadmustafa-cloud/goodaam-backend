const express = require('express');
const router = express.Router();
const gateController = require('../controllers/gate.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimiter.middleware');
const { validateObjectId } = require('../middleware/validateId.middleware');

// All routes require authentication
router.use(authenticate);

// Gate management routes
router.post('/arrival', writeLimiter, gateController.registerTruckArrival);
router.post('/:gateEntryId/weight-check', validateObjectId, writeLimiter, gateController.recordWeightReading);
router.post('/:gateEntryId/generate-pass', validateObjectId, writeLimiter, gateController.generateGatepass);
router.get('/', gateController.getGateEntries);
router.get('/statistics', gateController.getGateStatistics);
router.get('/:id', validateObjectId, gateController.getGateEntryById);
router.get('/:id/print', validateObjectId, gateController.printGatepass);
router.put('/:id/status', validateObjectId, writeLimiter, gateController.updateGateEntryStatus);
router.put('/:id/complete', validateObjectId, writeLimiter, gateController.completeGateEntry);

module.exports = router;
