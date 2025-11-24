const Vehicle = require('../models/Vehicle');
const Laad = require('../models/Laad');

exports.createVehicle = async (payload) => {
  // Check if vehicle number already exists
  const existing = await Vehicle.findOne({ number: payload.number.toUpperCase() });
  if (existing) {
    const e = new Error('Vehicle with this number already exists');
    e.status = 400;
    throw e;
  }

  const vehicle = new Vehicle({
    ...payload,
    number: payload.number.toUpperCase()
  });
  return await vehicle.save();
};

exports.getVehicles = async (filters = {}) => {
  const query = {};
  
  if (filters.isActive !== undefined) {
    query.isActive = filters.isActive === 'true' || filters.isActive === true;
  }
  
  if (filters.type) {
    query.type = filters.type;
  }

  const vehicles = await Vehicle.find(query)
    .sort({ createdAt: -1 })
    .lean();

  // Get laad count for each vehicle
  const vehiclesWithCount = await Promise.all(
    vehicles.map(async (vehicle) => {
      const laadCount = await Laad.countDocuments({ vehicleId: vehicle._id });
      return {
        ...vehicle,
        _count: {
          laads: laadCount
        }
      };
    })
  );

  return vehiclesWithCount;
};

exports.getVehicleById = async (id) => {
  const vehicle = await Vehicle.findById(id).lean();
  
  if (!vehicle) {
    return null;
  }

  // Get laads for this vehicle
  const laads = await Laad.find({ vehicleId: id })
    .populate('supplierId')
    .sort({ arrivalDate: -1 })
    .limit(10)
    .lean();

  return {
    ...vehicle,
    laads
  };
};

exports.updateVehicle = async (id, payload) => {
  const existing = await Vehicle.findById(id);
  
  if (!existing) {
    const e = new Error('Vehicle not found');
    e.status = 404;
    throw e;
  }

  // If updating number, check for duplicates
  if (payload.number && payload.number !== existing.number) {
    const duplicate = await Vehicle.findOne({ 
      number: payload.number.toUpperCase() 
    });
    
    if (duplicate) {
      const e = new Error('Vehicle with this number already exists');
      e.status = 400;
      throw e;
    }
  }

  const updateData = { ...payload };
  if (updateData.number) {
    updateData.number = updateData.number.toUpperCase();
  }
  if (updateData.capacity !== undefined) {
    updateData.capacity = updateData.capacity ? parseFloat(updateData.capacity) : null;
  }

  return await Vehicle.findByIdAndUpdate(id, updateData, { 
    new: true, 
    runValidators: true 
  });
};

exports.deleteVehicle = async (id) => {
  const vehicle = await Vehicle.findById(id).lean();
  
  if (!vehicle) {
    const e = new Error('Vehicle not found');
    e.status = 404;
    throw e;
  }

  // Check if vehicle has laads
  const laadCount = await Laad.countDocuments({ vehicleId: id });
  
  if (laadCount > 0) {
    const e = new Error(`Cannot delete vehicle. It has ${laadCount} associated laads. Consider deactivating instead.`);
    e.status = 400;
    throw e;
  }

  return await Vehicle.findByIdAndDelete(id);
};

exports.toggleVehicleStatus = async (id) => {
  const vehicle = await Vehicle.findById(id);
  
  if (!vehicle) {
    const e = new Error('Vehicle not found');
    e.status = 404;
    throw e;
  }

  vehicle.isActive = !vehicle.isActive;
  return await vehicle.save();
};

