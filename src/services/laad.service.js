const mongoose = require('mongoose');
const Laad = require('../models/Laad');
const LaadItem = require('../models/LaadItem');
const Supplier = require('../models/Supplier');
const Vehicle = require('../models/Vehicle');
const Item = require('../models/Item');
const { convertToObjectId } = require('../utils/convertId');

/**
 * payload = {
 *   laadNumber, vehicleNumber, vehicleId?, arrivalDate, supplierId, notes,
 *   items: [{ 
 *     itemId, totalBags, remainingBags?, 
 *     qualityGrade?, weightPerBag?, ratePerBag?,
 *     weightFromJacobabad?, faisalabadWeight?
 *   }]
 * }
 */
exports.createLaadWithItems = async (payload) => {
  const { items = [], ...laadData } = payload;

  // Ensure items is an array
  if (!Array.isArray(items)) {
    throw new Error(`Expected items to be an array, but got ${typeof items}: ${JSON.stringify(items)}`);
  }

  // Convert numeric IDs to ObjectIds
  if (laadData.supplierId) {
    laadData.supplierId = await convertToObjectId(laadData.supplierId, 'Supplier');
  }
  
  if (laadData.vehicleId) {
    laadData.vehicleId = await convertToObjectId(laadData.vehicleId, 'Vehicle');
  }

  try {
    // Create laad
    const laad = new Laad(laadData);
    await laad.save();

    // Create laad items
    const laadItems = [];
    for (const it of items) {
      // Convert itemId to ObjectId
      const itemObjectId = await convertToObjectId(it.itemId, 'Item');
      
      // Auto-calculate totalAmount if ratePerBag is provided
      const totalAmount = it.ratePerBag && it.totalBags 
        ? parseFloat(it.ratePerBag) * parseInt(it.totalBags)
        : null;

      const laadItem = new LaadItem({
        laadId: laad._id,
        itemId: itemObjectId,
        totalBags: it.totalBags,
        remainingBags: it.remainingBags ?? it.totalBags,
        qualityGrade: it.qualityGrade || null,
        weightPerBag: it.weightPerBag || null,
        ratePerBag: it.ratePerBag ? parseFloat(it.ratePerBag) : null,
        totalAmount: totalAmount,
        weightFromJacobabad: it.weightFromJacobabad ? parseFloat(it.weightFromJacobabad) : null,
        faisalabadWeight: it.faisalabadWeight ? parseFloat(it.faisalabadWeight) : null
      });

      await laadItem.save();
      laadItems.push(laadItem);
    }

    // Populate and return
    const populatedLaad = await Laad.findById(laad._id)
      .populate('supplierId')
      .populate('vehicleId')
      .lean();

    // Populate items
    const populatedItems = await LaadItem.find({ laadId: laad._id })
      .populate('itemId')
      .lean();

    // Transform to match frontend expectations
    return {
      ...populatedLaad,
      id: populatedLaad.id || populatedLaad._id.toString(),
      supplier: populatedLaad.supplierId ? {
        id: populatedLaad.supplierId.id || populatedLaad.supplierId._id.toString(),
        name: populatedLaad.supplierId.name || '',
        contact: populatedLaad.supplierId.contact || null
      } : { id: null, name: 'Unknown', contact: null },
      vehicle: populatedLaad.vehicleId ? {
        id: populatedLaad.vehicleId.id || populatedLaad.vehicleId._id.toString(),
        number: populatedLaad.vehicleId.number || '',
        type: populatedLaad.vehicleId.type || 'OTHER'
      } : null,
      items: populatedItems.map(item => ({
        ...item,
        id: item.id || item._id.toString(),
        item: item.itemId ? {
          id: item.itemId.id || item.itemId._id.toString(),
          name: item.itemId.name || 'Unknown',
          quality: item.itemId.quality || '',
          bagWeight: item.itemId.bagWeight || 0
        } : { id: null, name: 'Unknown', quality: '', bagWeight: 0 }
      }))
    };
  } catch (error) {
    throw error;
  }
};

exports.getLaads = async () => {
  const laads = await Laad.find()
    .sort({ arrivalDate: -1 })
    .populate('supplierId')
    .populate('vehicleId')
    .lean();

  // Get items for each laad and transform response
  const laadsWithItems = await Promise.all(
    laads.map(async (laad) => {
      const items = await LaadItem.find({ laadId: laad._id })
        .populate('itemId')
        .lean();
      
      // Transform to match frontend expectations
      return {
        ...laad,
        id: laad.id || laad._id.toString(),
        supplier: laad.supplierId ? {
          id: laad.supplierId.id || laad.supplierId._id.toString(),
          name: laad.supplierId.name || '',
          contact: laad.supplierId.contact || null
        } : { id: null, name: 'Unknown', contact: null },
        vehicle: laad.vehicleId ? {
          id: laad.vehicleId.id || laad.vehicleId._id.toString(),
          number: laad.vehicleId.number || '',
          type: laad.vehicleId.type || 'OTHER'
        } : null,
        items: items.map(item => ({
          ...item,
          id: item.id || item._id.toString(),
          item: item.itemId ? {
            id: item.itemId.id || item.itemId._id.toString(),
            name: item.itemId.name || 'Unknown',
            quality: item.itemId.quality || '',
            bagWeight: item.itemId.bagWeight || 0
          } : { id: null, name: 'Unknown', quality: '', bagWeight: 0 }
        }))
      };
    })
  );

  return laadsWithItems;
};

exports.getLaadById = async (id) => {
  // Support both auto-increment id and MongoDB _id
  let laad;
  if (typeof id === 'number' || /^\d+$/.test(id)) {
    laad = await Laad.findOne({ id: parseInt(id) })
      .populate('supplierId')
      .populate('vehicleId')
      .lean();
  } else {
    laad = await Laad.findById(id)
      .populate('supplierId')
      .populate('vehicleId')
      .lean();
  }

  if (!laad) {
    return null;
  }

  const items = await LaadItem.find({ laadId: laad._id })
    .populate('itemId')
    .lean();

  // Transform to match frontend expectations
  return {
    ...laad,
    id: laad.id || laad._id.toString(),
    supplier: laad.supplierId ? {
      id: laad.supplierId.id || laad.supplierId._id.toString(),
      name: laad.supplierId.name || '',
      contact: laad.supplierId.contact || null
    } : { id: null, name: 'Unknown', contact: null },
    vehicle: laad.vehicleId ? {
      id: laad.vehicleId.id || laad.vehicleId._id.toString(),
      number: laad.vehicleId.number || '',
      type: laad.vehicleId.type || 'OTHER'
    } : null,
    items: items.map(item => ({
      ...item,
      id: item.id || item._id.toString(),
      item: item.itemId ? {
        id: item.itemId.id || item.itemId._id.toString(),
        name: item.itemId.name || 'Unknown',
        quality: item.itemId.quality || '',
        bagWeight: item.itemId.bagWeight || 0
      } : { id: null, name: 'Unknown', quality: '', bagWeight: 0 }
    }))
  };
};

exports.updateLaadWithItems = async (id, payload) => {
  const { items = [], ...laadData } = payload;

  let laad = null;
  if (mongoose.Types.ObjectId.isValid(id)) {
    laad = await Laad.findById(id);
  }

  if (!laad && (typeof id === 'number' || /^\d+$/.test(id))) {
    laad = await Laad.findOne({ id: parseInt(id) });
  }

  if (!laad) {
    const error = new Error('Laad not found');
    error.statusCode = 404;
    throw error;
  }

  if (laadData.supplierId) {
    laadData.supplierId = await convertToObjectId(laadData.supplierId, 'Supplier');
  }

  if (laadData.vehicleId) {
    laadData.vehicleId = await convertToObjectId(laadData.vehicleId, 'Vehicle');
  }

  if (typeof laadData.vehicleNumber !== 'undefined') {
    laad.vehicleNumber = laadData.vehicleNumber || null;
  }

  if (laadData.supplierId) {
    laad.supplierId = laadData.supplierId;
  }

  if (laadData.vehicleId || laad.vehicleId) {
    laad.vehicleId = laadData.vehicleId || null;
  }

  if (laadData.laadNumber) {
    laad.laadNumber = laadData.laadNumber;
  }

  if (laadData.arrivalDate) {
    laad.arrivalDate = new Date(laadData.arrivalDate);
  }

  if (typeof laadData.notes !== 'undefined') {
    laad.notes = laadData.notes || null;
  }

  await laad.save();

  const existingItems = await LaadItem.find({ laadId: laad._id });
  const existingMap = new Map();
  existingItems.forEach((item) => {
    existingMap.set(item._id.toString(), item);
    if (typeof item.id !== 'undefined') {
      existingMap.set(item.id.toString(), item);
    }
  });

  for (const it of items) {
    const itemObjectId = await convertToObjectId(it.itemId, 'Item');
    const totalBags = parseInt(it.totalBags, 10) || 0;

    const updateData = {
      itemId: itemObjectId,
      totalBags,
      qualityGrade: it.qualityGrade || null,
      weightPerBag: it.weightPerBag ? parseFloat(it.weightPerBag) : null,
      ratePerBag: it.ratePerBag ? parseFloat(it.ratePerBag) : null,
      totalAmount: it.ratePerBag && totalBags ? parseFloat(it.ratePerBag) * totalBags : null,
      weightFromJacobabad: it.weightFromJacobabad ? parseFloat(it.weightFromJacobabad) : null,
      faisalabadWeight: it.faisalabadWeight ? parseFloat(it.faisalabadWeight) : null
    };

    if (typeof it.remainingBags === 'number') {
      updateData.remainingBags = Math.max(0, it.remainingBags);
    }

    const refId = it.laadItemId || it.id;
    if (refId && existingMap.has(refId.toString())) {
      const existing = existingMap.get(refId.toString());
      Object.assign(existing, updateData);
      if (typeof updateData.remainingBags === 'undefined' && (!existing.remainingBags || existing.remainingBags < 0)) {
        existing.remainingBags = totalBags;
      }
      await existing.save();
    } else {
      const laadItem = new LaadItem({
        laadId: laad._id,
        ...updateData,
        remainingBags: typeof updateData.remainingBags === 'number' ? updateData.remainingBags : totalBags
      });
      await laadItem.save();
    }
  }

  return exports.getLaadById(laad._id);
};