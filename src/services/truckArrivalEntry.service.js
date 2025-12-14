const TruckArrivalEntry = require('../models/TruckArrivalEntry');
const { convertToObjectId } = require('../utils/convertId');

exports.getTruckArrivalEntries = async (filters = {}) => {
  const query = {};
  
  if (filters.laadNumber) {
    query.laadNumber = filters.laadNumber;
  }
  
  if (filters.startDate || filters.endDate) {
    query.arrivalDate = {};
    if (filters.startDate) {
      query.arrivalDate.$gte = new Date(filters.startDate);
    }
    if (filters.endDate) {
      query.arrivalDate.$lte = new Date(filters.endDate);
    }
  }

  const entries = await TruckArrivalEntry.find(query)
    .sort({ createdAt: -1 })
    .populate('supplierId', 'name contact')
    .populate('laadId', 'laadNumber arrivalDate')
    .populate('createdBy', 'name email')
    .lean();

  return entries.map(entry => ({
    ...entry,
    id: entry.id || entry._id.toString(),
    laadId: entry.laadId ? (entry.laadId._id?.toString() || entry.laadId.id || entry.laadId.toString()) : null,
    supplier: entry.supplierId ? {
      id: entry.supplierId._id?.toString() || entry.supplierId.id,
      name: entry.supplierId.name || 'Unknown',
      contact: entry.supplierId.contact || null
    } : null,
    laad: entry.laadId ? {
      id: entry.laadId._id?.toString() || entry.laadId.id,
      laadNumber: entry.laadId.laadNumber || entry.laadNumber,
      arrivalDate: entry.laadId.arrivalDate || entry.arrivalDate
    } : null,
    createdByUser: entry.createdBy ? {
      id: entry.createdBy._id?.toString() || entry.createdBy.id,
      name: entry.createdBy.name || 'Unknown',
      email: entry.createdBy.email || null
    } : null
  }));
};

exports.getTruckArrivalEntryById = async (id) => {
  let entry;
  if (typeof id === 'number' || /^\d+$/.test(id)) {
    entry = await TruckArrivalEntry.findOne({ id: parseInt(id) })
      .populate('supplierId', 'name contact')
      .populate('laadId', 'laadNumber arrivalDate')
      .populate('createdBy', 'name email')
      .lean();
  } else {
    entry = await TruckArrivalEntry.findById(id)
      .populate('supplierId', 'name contact')
      .populate('laadId', 'laadNumber arrivalDate')
      .populate('createdBy', 'name email')
      .lean();
  }

  if (!entry) {
    return null;
  }

  return {
    ...entry,
    id: entry.id || entry._id.toString(),
    laadId: entry.laadId ? (entry.laadId._id?.toString() || entry.laadId.id || entry.laadId.toString()) : null,
    supplier: entry.supplierId ? {
      id: entry.supplierId._id?.toString() || entry.supplierId.id,
      name: entry.supplierId.name || 'Unknown',
      contact: entry.supplierId.contact || null
    } : null,
    laad: entry.laadId ? {
      id: entry.laadId._id?.toString() || entry.laadId.id,
      laadNumber: entry.laadId.laadNumber || entry.laadNumber,
      arrivalDate: entry.laadId.arrivalDate || entry.arrivalDate
    } : null,
    createdByUser: entry.createdBy ? {
      id: entry.createdBy._id?.toString() || entry.createdBy.id,
      name: entry.createdBy.name || 'Unknown',
      email: entry.createdBy.email || null
    } : null
  };
};

exports.updateTruckArrivalEntry = async (id, updateData) => {
  let entry;
  if (typeof id === 'number' || /^\d+$/.test(id)) {
    entry = await TruckArrivalEntry.findOne({ id: parseInt(id) });
  } else {
    entry = await TruckArrivalEntry.findById(id);
  }

  if (!entry) {
    const error = new Error('Truck arrival entry not found');
    error.statusCode = 404;
    throw error;
  }

  // Update allowed fields
  if (updateData.laadNumber !== undefined) {
    entry.laadNumber = updateData.laadNumber;
  }
  if (updateData.supplierId !== undefined) {
    entry.supplierId = updateData.supplierId ? await convertToObjectId(updateData.supplierId, 'Supplier') : null;
  }
  if (updateData.arrivalDate !== undefined) {
    entry.arrivalDate = new Date(updateData.arrivalDate);
  }
  if (updateData.gatePassNumber !== undefined) {
    entry.gatePassNumber = updateData.gatePassNumber || null;
  }
  if (updateData.notes !== undefined) {
    entry.notes = updateData.notes || null;
  }
  if (updateData.items !== undefined && Array.isArray(updateData.items)) {
    entry.items = updateData.items;
    // Recalculate totals
    entry.totalBags = updateData.items.reduce((sum, item) => sum + (item.totalBags || 0), 0);
    entry.totalWeight = updateData.items.reduce((sum, item) => {
      const bags = item.totalBags || 0;
      const weightPerBag = item.weightPerBag || 0;
      return sum + (bags * weightPerBag);
    }, 0);
  }

  await entry.save();
  return exports.getTruckArrivalEntryById(entry._id);
};

exports.deleteTruckArrivalEntry = async (id) => {
  let entry;
  if (typeof id === 'number' || /^\d+$/.test(id)) {
    entry = await TruckArrivalEntry.findOne({ id: parseInt(id) });
  } else {
    entry = await TruckArrivalEntry.findById(id);
  }

  if (!entry) {
    const error = new Error('Truck arrival entry not found');
    error.statusCode = 404;
    throw error;
  }

  await TruckArrivalEntry.findByIdAndDelete(entry._id);
  return { message: 'Truck arrival entry deleted successfully' };
};

