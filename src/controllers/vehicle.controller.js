const prisma = require('../config/prisma');

// Get all vehicles
exports.getVehicles = async (req, res, next) => {
  try {
    const { isActive, type } = req.query;
    
    const where = {};
    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }
    if (type) {
      where.type = type;
    }

    const vehicles = await prisma.vehicle.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { laads: true }
        }
      }
    });

    res.json({ success: true, data: vehicles });
  } catch (err) { next(err); }
};

// Get vehicle by ID
exports.getVehicleById = async (req, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        laads: {
          include: {
            supplier: true
          },
          orderBy: { arrivalDate: 'desc' },
          take: 10
        }
      }
    });

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

    // Check if vehicle number already exists
    const existing = await prisma.vehicle.findUnique({
      where: { number }
    });

    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Vehicle with this number already exists'
      });
    }

    const vehicle = await prisma.vehicle.create({
      data: {
        number: number.toUpperCase(),
        type,
        capacity: capacity ? parseFloat(capacity) : null,
        ownerName: ownerName || null,
        ownerContact: ownerContact || null,
        isActive: isActive !== undefined ? isActive : true
      }
    });

    res.status(201).json({ success: true, data: vehicle });
  } catch (err) { next(err); }
};

// Update vehicle
exports.updateVehicle = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { number, type, capacity, ownerName, ownerContact, isActive } = req.body;

    // Check if vehicle exists
    const existing = await prisma.vehicle.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // If updating number, check for duplicates
    if (number && number !== existing.number) {
      const duplicate = await prisma.vehicle.findUnique({
        where: { number: number.toUpperCase() }
      });

      if (duplicate) {
        return res.status(400).json({
          success: false,
          message: 'Vehicle with this number already exists'
        });
      }
    }

    const vehicle = await prisma.vehicle.update({
      where: { id: parseInt(id) },
      data: {
        number: number ? number.toUpperCase() : undefined,
        type: type || undefined,
        capacity: capacity !== undefined ? (capacity ? parseFloat(capacity) : null) : undefined,
        ownerName: ownerName !== undefined ? ownerName : undefined,
        ownerContact: ownerContact !== undefined ? ownerContact : undefined,
        isActive: isActive !== undefined ? isActive : undefined
      }
    });

    res.json({ success: true, data: vehicle });
  } catch (err) { next(err); }
};

// Delete vehicle
exports.deleteVehicle = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check if vehicle exists
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: parseInt(id) },
      include: {
        _count: {
          select: { laads: true }
        }
      }
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    // Prevent deletion if vehicle has laads
    if (vehicle._count.laads > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete vehicle. It has ${vehicle._count.laads} associated laads. Consider deactivating instead.`
      });
    }

    await prisma.vehicle.delete({
      where: { id: parseInt(id) }
    });

    res.json({ 
      success: true, 
      message: 'Vehicle deleted successfully' 
    });
  } catch (err) { next(err); }
};

// Toggle vehicle active status
exports.toggleVehicleStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    const vehicle = await prisma.vehicle.findUnique({
      where: { id: parseInt(id) }
    });

    if (!vehicle) {
      return res.status(404).json({
        success: false,
        message: 'Vehicle not found'
      });
    }

    const updated = await prisma.vehicle.update({
      where: { id: parseInt(id) },
      data: {
        isActive: !vehicle.isActive
      }
    });

    res.json({ 
      success: true, 
      data: updated,
      message: `Vehicle ${updated.isActive ? 'activated' : 'deactivated'} successfully` 
    });
  } catch (err) { next(err); }
};

