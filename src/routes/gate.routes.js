const express = require('express');
const router = express.Router();
const gateController = require('../controllers/gate.controller');

// Gate management routes
router.post('/arrival', gateController.registerTruckArrival);
router.post('/:gateEntryId/weight-check', gateController.recordWeightReading);
router.post('/:gateEntryId/generate-pass', gateController.generateGatepass);
router.get('/', gateController.getGateEntries);
router.get('/statistics', gateController.getGateStatistics);
router.get('/:id', gateController.getGateEntryById);
router.get('/:id/print', gateController.printGatepass);
router.put('/:id/status', gateController.updateGateEntryStatus);
router.put('/:id/complete', gateController.completeGateEntry);

module.exports = router;
