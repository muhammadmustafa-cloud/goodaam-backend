const svc = require('../services/truckArrivalEntry.service');

exports.getTruckArrivalEntries = async (req, res, next) => {
  try {
    const filters = {
      laadNumber: req.query.laadNumber,
      startDate: req.query.startDate,
      endDate: req.query.endDate
    };
    const entries = await svc.getTruckArrivalEntries(filters);
    res.json({ success: true, data: entries });
  } catch (err) { next(err); }
};

exports.getTruckArrivalEntryById = async (req, res, next) => {
  try {
    const entry = await svc.getTruckArrivalEntryById(req.params.id);
    if (!entry) {
      return res.status(404).json({
        success: false,
        message: 'Truck arrival entry not found'
      });
    }
    res.json({ success: true, data: entry });
  } catch (err) { next(err); }
};

exports.updateTruckArrivalEntry = async (req, res, next) => {
  try {
    const entry = await svc.updateTruckArrivalEntry(req.params.id, req.body);
    res.json({ success: true, data: entry });
  } catch (err) { 
    if (err.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: err.message
      });
    }
    next(err); 
  }
};

exports.deleteTruckArrivalEntry = async (req, res, next) => {
  try {
    await svc.deleteTruckArrivalEntry(req.params.id);
    res.json({ success: true, message: 'Truck arrival entry deleted successfully' });
  } catch (err) {
    if (err.statusCode === 404) {
      return res.status(404).json({
        success: false,
        message: err.message
      });
    }
    next(err);
  }
};

