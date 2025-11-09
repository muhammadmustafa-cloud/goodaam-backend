const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicle.controller');
const { authenticate } = require('../middleware/auth.middleware');
const { writeLimiter } = require('../middleware/rateLimiter.middleware');
const { validateVehicle } = require('../middleware/security.middleware');

// All routes require authentication
router.use(authenticate);

// Vehicle routes
router.get('/', vehicleController.getVehicles);
router.get('/:id', vehicleController.getVehicleById);
router.post('/', writeLimiter, validateVehicle, vehicleController.createVehicle);
router.put('/:id', writeLimiter, validateVehicle, vehicleController.updateVehicle);
router.delete('/:id', writeLimiter, vehicleController.deleteVehicle);
router.patch('/:id/toggle-status', writeLimiter, vehicleController.toggleVehicleStatus);

module.exports = router;

