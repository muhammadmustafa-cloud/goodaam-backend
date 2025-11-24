const service = require('../services/vehicle.service');

// Get all vehicles
exports.getVehicles = async (req, res, next) => {
  try {
    const { isActive, type } = req.query;
    
    const filters = { isActive, type };
    const vehicles = await service.getVehicles(filters);

    res.json({ success: true, data: vehicles });
  } catch (err) { next(err); }
};

// Get vehicle by ID
exports.getVehicleById = async (req, res, next) => {
  try {
    const vehicle = await service.getVehicleById(req.params.id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    res.json({ success: true, data: vehicle });
  } catch (err) { next(err); }
};

// Create vehicle
exports.createVehicle = async (req, res, next) => {
  try {
    const { number, type, capacity, ownerName, ownerContact, isActive } = req.body;

    if (!number || !type) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle number and type are required'
      });
    }

    const vehicle = await service.createVehicle({
      number,
      type,
      capacity,
      ownerName,
      ownerContact,
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json({ success: true, data: vehicle });
  } catch (err) { 
    if (err.status === 400) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    next(err); 
  }
};

// Update vehicle
exports.updateVehicle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { number, type, capacity, ownerName, ownerContact, isActive } = req.body;

    const vehicle = await service.updateVehicle(id, {
      number,
      type,
      capacity,
      ownerName,
      ownerContact,
      isActive
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    res.json({ success: true, data: vehicle });
  } catch (err) { 
    if (err.status === 400 || err.status === 404) {
      return res.status(err.status).json({
        success: false,
        message: err.message
      });
    }
    next(err); 
  }
};

// Delete vehicle
exports.deleteVehicle = async (req, res, next) => {
  try {
    const { id } = req.params;

    const result = await service.deleteVehicle(id);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    res.json({ 
      success: true, 
      message: 'Vehicle deleted successfully' 
    });
  } catch (err) { 
    if (err.status === 400 || err.status === 404) {
      return res.status(err.status).json({
        success: false,
        message: err.message
      });
    }
    next(err); 
  }
};

// Toggle vehicle active status
exports.toggleVehicleStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const vehicle = await service.toggleVehicleStatus(id);

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    res.json({ 
      success: true, 
      data: vehicle,
      message: `Vehicle ${vehicle.isActive ? 'activated' : 'deactivated'} successfully` 
    });
  } catch (err) { 
    if (err.status === 404) {
      return res.status(404).json({
        success: false,
        message: err.message
      });
    }
    next(err); 
  }
};
