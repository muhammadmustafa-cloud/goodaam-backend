const service = require('../services/gate.service');

// Register truck arrival
exports.registerTruckArrival = async (req, res, next) => {
  try {
    const { truckNumber, driverName, createdById } = req.body;

    if (!truckNumber || !createdById) {
      return res.status(400).json({
        success: false,
        message: 'truckNumber and createdById are required'
      });
    }

    const gateEntry = await service.registerTruckArrival({
      truckNumber,
      driverName,
      createdById
    });

    res.json({ success: true, data: gateEntry });
  } catch (err) { next(err); }
};

// Record weight machine reading
exports.recordWeightReading = async (req, res, next) => {
  try {
    const { gateEntryId } = req.params;
    const { grossWeight, tareWeight, netWeight, weightMachineReading } = req.body;

    if (!grossWeight || !tareWeight || !netWeight) {
      return res.status(400).json({
        success: false,
        message: 'grossWeight, tareWeight, and netWeight are required'
      });
    }

    const gateEntry = await service.recordWeightReading(gateEntryId, {
      grossWeight,
      tareWeight,
      netWeight,
      weightMachineReading
    });

    res.json({ success: true, data: gateEntry });
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

// Generate gatepass with advanced features
exports.generateGatepass = async (req, res, next) => {
  try {
    const { gateEntryId } = req.params;
    const { laadId, items, gatepassType = 'STANDARD' } = req.body;

    if (!laadId || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'laadId and items array are required'
      });
    }

    const result = await service.generateGatepass(gateEntryId, {
      laadId,
      items
    });

    res.json({ 
      success: true, 
      data: result,
      gatepassNumber: result.gatepassNumber,
      message: 'Gatepass generated successfully'
    });
  } catch (err) { 
    if (err.status === 404 || err.status === 400) {
      return res.status(err.status).json({
        success: false,
        message: err.message
      });
    }
    next(err); 
  }
};

// Get gate entries
exports.getGateEntries = async (req, res, next) => {
  try {
    const { status, dateFrom, dateTo } = req.query;
    
    const filters = { status, dateFrom, dateTo };
    const entries = await service.getGateEntries(filters);

    res.json({ success: true, data: entries });
  } catch (err) { next(err); }
};

// Get gate entry by ID
exports.getGateEntryById = async (req, res, next) => {
  try {
    const entry = await service.getGateEntryById(req.params.id);

    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Gate entry not found'
      });
    }

    res.json({ success: true, data: entry });
  } catch (err) { next(err); }
};

// Update gate entry status
exports.updateGateEntryStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'status is required'
      });
    }

    const entry = await service.updateGateEntryStatus(id, status);

    res.json({ success: true, data: entry });
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

// Complete gate entry (final step)
exports.completeGateEntry = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes, finalWeight } = req.body;

    const entry = await service.completeGateEntry(id, {
      notes,
      finalWeight
    });

    res.json({ 
      success: true, 
      data: entry,
      message: 'Gate entry completed successfully'
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

// Get gate statistics
exports.getGateStatistics = async (req, res, next) => {
  try {
    const { dateFrom, dateTo } = req.query;
    
    const filters = { dateFrom, dateTo };
    const statistics = await service.getGateStatistics(filters);

    res.json({
      success: true,
      data: statistics
    });
  } catch (err) { next(err); }
};

// Print gatepass
exports.printGatepass = async (req, res, next) => {
  try {
    const { id } = req.params;

    const gatepassData = await service.printGatepass(id);

    res.json({
      success: true,
      data: gatepassData,
      message: 'Gatepass ready for printing'
    });
  } catch (err) { 
    if (err.status === 404 || err.status === 400) {
      return res.status(err.status).json({
        success: false,
        message: err.message
      });
    }
    next(err); 
  }
};
