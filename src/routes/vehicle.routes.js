const express = require('express');
const router = express.Router();
const vehicleController = require('../controllers/vehicle.controller');

// Vehicle routes
router.get('/', vehicleController.getVehicles);
router.get('/:id', vehicleController.getVehicleById);
router.post('/', vehicleController.createVehicle);
router.put('/:id', vehicleController.updateVehicle);
router.delete('/:id', vehicleController.deleteVehicle);
router.patch('/:id/toggle-status', vehicleController.toggleVehicleStatus);

module.exports = router;

