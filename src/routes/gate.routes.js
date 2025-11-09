const express = require('express');
const router = express.Router();
const gateController = require('../controllers/gate.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimiter.middleware');

// All routes require authentication
router.use(authenticate);

// Gate management routes
router.post('/arrival', writeLimiter, gateController.registerTruckArrival);
router.post('/:gateEntryId/weight-check', writeLimiter, gateController.recordWeightReading);
router.post('/:gateEntryId/generate-pass', writeLimiter, gateController.generateGatepass);
router.get('/', gateController.getGateEntries);
router.get('/statistics', gateController.getGateStatistics);
router.get('/:id', gateController.getGateEntryById);
router.get('/:id/print', gateController.printGatepass);
router.put('/:id/status', writeLimiter, gateController.updateGateEntryStatus);
router.put('/:id/complete', writeLimiter, gateController.completeGateEntry);

module.exports = router;
