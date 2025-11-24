const GateEntry = require('../models/GateEntry');
const Laad = require('../models/Laad');
const LaadItem = require('../models/LaadItem');
const User = require('../models/User');

exports.registerTruckArrival = async (payload) => {
  const { truckNumber, driverName, createdById } = payload;

  const gateEntry = new GateEntry({
    truckNumber,
    driverName: driverName || null,
    createdById,
    status: 'PENDING'
  });

  await gateEntry.save();

  // Populate createdBy
  const populated = await GateEntry.findById(gateEntry._id)
    .populate('createdById', 'name email')
    .lean();

  return populated;
};

exports.recordWeightReading = async (gateEntryId, payload) => {
  const { grossWeight, tareWeight, netWeight, weightMachineReading } = payload;

  const gateEntry = await GateEntry.findByIdAndUpdate(
    gateEntryId,
    {
      grossWeight: parseFloat(grossWeight),
      tareWeight: parseFloat(tareWeight),
      netWeight: parseFloat(netWeight),
      weightMachineReading: weightMachineReading ? parseFloat(weightMachineReading) : null,
      status: 'WEIGHED'
    },
    { new: true }
  )
    .populate('createdById', 'name email')
    .lean();

  if (!gateEntry) {
    const e = new Error('Gate entry not found');
    e.status = 404;
    throw e;
  }

  return gateEntry;
};

exports.generateGatepass = async (gateEntryId, payload) => {
  const { laadId, items } = payload;

  // Generate professional gatepass number
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const timeStr = date.toTimeString().slice(0, 8).replace(/:/g, '');
  const gatepassNumber = `GP-${dateStr}-${timeStr}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;

  // MongoDB session for transaction
  const session = await GateEntry.startSession();
  session.startTransaction();

  try {
    // Update gate entry
    const gateEntry = await GateEntry.findByIdAndUpdate(
      gateEntryId,
      {
        laadId,
        gatepassNumber,
        status: 'PROCESSED'
      },
      { new: true, session }
    );

    if (!gateEntry) {
      const e = new Error('Gate entry not found');
      e.status = 404;
      throw e;
    }

    // Update laad items
    for (const item of items) {
      await LaadItem.findByIdAndUpdate(
        item.laadItemId,
        {
          qualityGrade: item.qualityGrade || null,
          weightPerBag: item.weightPerBag || null
        },
        { session }
      );
    }

    await session.commitTransaction();

    // Populate and return
    const populated = await GateEntry.findById(gateEntry._id)
      .populate('createdById', 'name email')
      .populate({
        path: 'laadId',
        populate: {
          path: 'supplierId',
          model: 'Supplier'
        }
      })
      .lean();

    // Get items separately (LaadItem documents)
    if (populated && populated.laadId) {
      const LaadItem = require('../models/LaadItem');
      const items = await LaadItem.find({ laadId: populated.laadId._id })
        .populate('itemId')
        .lean();
      populated.laadId.items = items;
    }

    return populated;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

exports.getGateEntries = async (filters = {}) => {
  const { status, dateFrom, dateTo } = filters;
  
  const query = {};
  
  if (status) {
    query.status = status;
  }
  
  if (dateFrom || dateTo) {
    query.arrivalTime = {};
    if (dateFrom) query.arrivalTime.$gte = new Date(dateFrom);
    if (dateTo) query.arrivalTime.$lte = new Date(dateTo);
  }

  const entries = await GateEntry.find(query)
    .sort({ arrivalTime: -1 })
    .populate('createdById', 'name email')
    .populate({
      path: 'laadId',
      populate: {
        path: 'supplierId',
        model: 'Supplier'
      }
    })
    .lean();

  // Get items for each laad separately
  const LaadItem = require('../models/LaadItem');
  const entriesWithItems = await Promise.all(
    entries.map(async (entry) => {
      if (entry.laadId) {
        const items = await LaadItem.find({ laadId: entry.laadId._id })
          .populate('itemId')
          .lean();
        entry.laadId.items = items;
      }
      return entry;
    })
  );

  return entriesWithItems;
};

exports.getGateEntryById = async (id) => {
  const entry = await GateEntry.findById(id)
    .populate('createdById', 'name email')
    .populate({
      path: 'laadId',
      populate: {
        path: 'supplierId',
        model: 'Supplier'
      }
    })
    .lean();

  // Get items separately
  if (entry && entry.laadId) {
    const LaadItem = require('../models/LaadItem');
    const items = await LaadItem.find({ laadId: entry.laadId._id })
      .populate('itemId')
      .lean();
    entry.laadId.items = items;
  }

  return entry;
};

exports.updateGateEntryStatus = async (id, status) => {
  const validStatuses = ['PENDING', 'WEIGHED', 'PROCESSED', 'COMPLETED', 'CANCELLED'];
  if (!validStatuses.includes(status)) {
    const e = new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    e.status = 400;
    throw e;
  }

  const entry = await GateEntry.findByIdAndUpdate(
    id,
    { status },
    { new: true }
  )
    .populate('createdById', 'name email')
    .populate({
      path: 'laadId',
      populate: {
        path: 'supplierId',
        model: 'Supplier'
      }
    })
    .lean();

  // Get items separately
  if (entry && entry.laadId) {
    const LaadItem = require('../models/LaadItem');
    const items = await LaadItem.find({ laadId: entry.laadId._id })
      .populate('itemId')
      .lean();
    entry.laadId.items = items;
  }

  if (!entry) {
    const e = new Error('Gate entry not found');
    e.status = 404;
    throw e;
  }

  return entry;
};

exports.completeGateEntry = async (id, payload) => {
  const { notes, finalWeight } = payload;

  const entry = await GateEntry.findByIdAndUpdate(
    id,
    {
      status: 'COMPLETED',
      notes: notes || null,
      netWeight: finalWeight ? parseFloat(finalWeight) : null
    },
    { new: true }
  )
    .populate('createdById', 'name email')
    .populate({
      path: 'laadId',
      populate: {
        path: 'supplierId',
        model: 'Supplier'
      }
    })
    .lean();

  // Get items separately
  if (entry && entry.laadId) {
    const LaadItem = require('../models/LaadItem');
    const items = await LaadItem.find({ laadId: entry.laadId._id })
      .populate('itemId')
      .lean();
    entry.laadId.items = items;
  }

  if (!entry) {
    const e = new Error('Gate entry not found');
    e.status = 404;
    throw e;
  }

  return entry;
};

exports.getGateStatistics = async (filters = {}) => {
  const { dateFrom, dateTo } = filters;
  
  const query = {};
  if (dateFrom || dateTo) {
    query.arrivalTime = {};
    if (dateFrom) query.arrivalTime.$gte = new Date(dateFrom);
    if (dateTo) query.arrivalTime.$lte = new Date(dateTo);
  }

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    totalEntries,
    pendingEntries,
    completedEntries,
    todayEntries,
    weightResult
  ] = await Promise.all([
    GateEntry.countDocuments(query),
    GateEntry.countDocuments({ ...query, status: 'PENDING' }),
    GateEntry.countDocuments({ ...query, status: 'COMPLETED' }),
    GateEntry.countDocuments({
      ...query,
      arrivalTime: { $gte: todayStart }
    }),
    GateEntry.aggregate([
      { $match: { ...query, netWeight: { $ne: null } } },
      { $group: { _id: null, totalWeight: { $sum: '$netWeight' } } }
    ])
  ]);

  const totalWeight = weightResult.length > 0 ? weightResult[0].totalWeight : 0;

  return {
    totalEntries,
    pendingEntries,
    completedEntries,
    todayEntries,
    totalWeight,
    completionRate: totalEntries > 0 ? (completedEntries / totalEntries * 100).toFixed(2) : 0
  };
};

exports.printGatepass = async (id) => {
  const gateEntry = await GateEntry.findById(id)
    .populate('createdById', 'name email')
    .populate({
      path: 'laadId',
      populate: {
        path: 'supplierId',
        model: 'Supplier'
      }
    })
    .lean();

  // Get items separately
  if (gateEntry && gateEntry.laadId) {
    const LaadItem = require('../models/LaadItem');
    const items = await LaadItem.find({ laadId: gateEntry.laadId._id })
      .populate('itemId')
      .lean();
    gateEntry.laadId.items = items;
  }

  if (!gateEntry) {
    const e = new Error('Gate entry not found');
    e.status = 404;
    throw e;
  }

  if (!gateEntry.gatepassNumber) {
    const e = new Error('Gatepass not generated yet');
    e.status = 400;
    throw e;
  }

  return {
    gatepassNumber: gateEntry.gatepassNumber,
    truckNumber: gateEntry.truckNumber,
    driverName: gateEntry.driverName,
    arrivalTime: gateEntry.arrivalTime,
    grossWeight: gateEntry.grossWeight,
    tareWeight: gateEntry.tareWeight,
    netWeight: gateEntry.netWeight,
    supplier: gateEntry.laadId?.supplierId || null,
    items: gateEntry.laadId?.items || [],
    createdBy: gateEntry.createdById,
    status: gateEntry.status,
    printTime: new Date().toISOString()
  };
};

