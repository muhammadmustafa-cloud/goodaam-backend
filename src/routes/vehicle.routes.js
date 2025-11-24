const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicle.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimiter.middleware');
const { validateVehicle } = require('../middleware/security.middleware');
const { validateObjectId } = require('../middleware/validateId.middleware');

// All routes require authentication
router.use(authenticate);

// Vehicle routes
router.get('/', vehicleController.getVehicles);
router.get('/:id', validateObjectId, vehicleController.getVehicleById);
router.post('/', writeLimiter, validateVehicle, vehicleController.createVehicle);
router.put('/:id', validateObjectId, writeLimiter, validateVehicle, vehicleController.updateVehicle);
router.delete('/:id', validateObjectId, writeLimiter, vehicleController.deleteVehicle);
router.patch('/:id/toggle-status', validateObjectId, writeLimiter, vehicleController.toggleVehicleStatus);

module.exports = router;

