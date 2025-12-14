const mongoose = require('mongoose');
const Laad = require('../models/Laad');
const LaadItem = require('../models/LaadItem');
const Supplier = require('../models/Supplier');
const Vehicle = require('../models/Vehicle');
const Item = require('../models/Item');
const TruckArrivalEntry = require('../models/TruckArrivalEntry');
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
    // Check if laad with same laadNumber already exists
    let laad = await Laad.findOne({ laadNumber: laadData.laadNumber });
    
    if (laad) {
      // Laad already exists - don't create duplicate, just add items to existing laad
      // Update laad metadata if needed (optional - only if missing)
      if (laadData.supplierId && !laad.supplierId) {
        laad.supplierId = laadData.supplierId;
      }
      if (laadData.vehicleId && !laad.vehicleId) {
        laad.vehicleId = laadData.vehicleId;
      }
      if (laadData.gatePassNumber && !laad.gatePassNumber) {
        laad.gatePassNumber = laadData.gatePassNumber;
      }
      if (laadData.notes && !laad.notes) {
        laad.notes = laadData.notes;
      }
      await laad.save();
    } else {
      // Create new laad only if it doesn't exist
      laad = new Laad(laadData);
      await laad.save();
    }

    // Get existing items from laad to check for duplicates
    const existingItems = await LaadItem.find({ laadId: laad._id }).populate('itemId');
    const duplicateCheckMap = new Map(); // For checking duplicates by itemName + qualityGrade
    
    existingItems.forEach((item) => {
      // Create key for duplicate check: itemName + qualityGrade
      // This allows same item name with different Item IDs to be treated as duplicates
      const itemName = (item.itemId?.name || '').trim().toLowerCase();
      const qualityGrade = (item.qualityGrade || '').trim();
      const duplicateKey = `${itemName}_${qualityGrade}`;
      duplicateCheckMap.set(duplicateKey, item);
    });

    // Track items for truck arrival entry (including duplicates)
    const truckArrivalItems = [];
    let totalBags = 0;
    let totalWeight = 0;

    // Add items to laad (skip duplicates)
    const laadItems = [];
    for (const it of items) {
      // Convert itemId to ObjectId
      const itemObjectId = await convertToObjectId(it.itemId, 'Item');
      const qualityGrade = (it.qualityGrade || '').trim();
      
      // Get item details for truck arrival entry
      const itemDoc = await Item.findById(itemObjectId).lean();
      const itemName = (itemDoc?.name || 'Unknown').trim().toLowerCase();
      const itemQuality = itemDoc?.quality || '';
      
      // Create duplicate check key: itemName + qualityGrade
      // This allows same item name with different Item IDs to be treated as duplicates
      const duplicateKey = `${itemName}_${qualityGrade}`;
      
      // Track item for truck arrival entry (regardless of duplicate status)
      const bags = parseInt(it.totalBags) || 0;
      const weightPerBag = parseFloat(it.weightPerBag) || 0;
      totalBags += bags;
      totalWeight += bags * weightPerBag;
      
      let laadItemId = null;
      let itemStatus = 'ADDED';
      
      // Check for duplicate - skip if already exists in laad
      if (duplicateCheckMap.has(duplicateKey)) {
        console.log(`Skipping duplicate item: itemId=${itemObjectId}, qualityGrade=${qualityGrade}`);
        itemStatus = 'DUPLICATE_SKIPPED';
        // Still track it in truck arrival entry
      } else {
        // Auto-calculate totalAmount if ratePerBag is provided
        const totalAmount = it.ratePerBag && it.totalBags 
          ? parseFloat(it.ratePerBag) * parseInt(it.totalBags)
          : null;

        const laadItem = new LaadItem({
          laadId: laad._id, // Add to laad (existing or new)
          itemId: itemObjectId,
          totalBags: it.totalBags,
          remainingBags: it.remainingBags ?? it.totalBags,
          qualityGrade: qualityGrade || null,
          weightPerBag: it.weightPerBag || null,
          ratePerBag: it.ratePerBag ? parseFloat(it.ratePerBag) : null,
          totalAmount: totalAmount,
          weightFromJacobabad: it.weightFromJacobabad ? parseFloat(it.weightFromJacobabad) : null,
          faisalabadWeight: it.faisalabadWeight ? parseFloat(it.faisalabadWeight) : null
        });

        await laadItem.save();
        laadItems.push(laadItem);
        laadItemId = laadItem._id;
        // Add to duplicate check map to prevent duplicates in same batch
        duplicateCheckMap.set(duplicateKey, laadItem);
      }
      
      // Add to truck arrival entry items (track all items, even duplicates)
      truckArrivalItems.push({
        itemId: itemObjectId,
        itemName,
        itemQuality,
        totalBags: bags,
        qualityGrade: qualityGrade || null,
        weightPerBag: it.weightPerBag ? parseFloat(it.weightPerBag) : null,
        weightFromJacobabad: it.weightFromJacobabad ? parseFloat(it.weightFromJacobabad) : null,
        faisalabadWeight: it.faisalabadWeight ? parseFloat(it.faisalabadWeight) : null,
        ratePerBag: it.ratePerBag ? parseFloat(it.ratePerBag) : null,
        totalAmount: it.ratePerBag && bags ? parseFloat(it.ratePerBag) * bags : null,
        status: itemStatus,
        laadItemId
      });
    }

    // Create truck arrival entry record (tracks all submissions, even with duplicate items)
    const truckArrivalEntry = new TruckArrivalEntry({
      laadNumber: laadData.laadNumber,
      laadId: laad._id,
      supplierId: laadData.supplierId || null,
      arrivalDate: new Date(laadData.arrivalDate),
      gatePassNumber: laadData.gatePassNumber || null,
      notes: laadData.notes || null,
      items: truckArrivalItems,
      totalBags,
      totalWeight,
      createdBy: laadData.createdBy || null
    });
    await truckArrivalEntry.save();

    // Populate and return the laad (existing or newly created)
    const populatedLaad = await Laad.findById(laad._id)
      .populate('supplierId')
      .populate('vehicleId')
      .lean();

    // Populate items from laad
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

// Get laad by laadNumber
exports.getLaadByLaadNumber = async (laadNumber) => {
  const laad = await Laad.findOne({ laadNumber })
    .populate('supplierId')
    .populate('vehicleId')
    .lean();

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

  if (typeof laadData.gatePassNumber !== 'undefined') {
    laad.gatePassNumber = laadData.gatePassNumber || null;
  }

  if (typeof laadData.notes !== 'undefined') {
    laad.notes = laadData.notes || null;
  }

  await laad.save();

  // Get existing items and create a map for duplicate checking
  const existingItems = await LaadItem.find({ laadId: laad._id }).populate('itemId');
  const existingMap = new Map();
  const duplicateCheckMap = new Map(); // For checking duplicates by itemId + qualityGrade
  
  existingItems.forEach((item) => {
    existingMap.set(item._id.toString(), item);
    if (typeof item.id !== 'undefined') {
      existingMap.set(item.id.toString(), item);
    }
    // Create key for duplicate check: itemId + qualityGrade
    const duplicateKey = `${item.itemId._id.toString()}_${(item.qualityGrade || '').trim()}`;
    duplicateCheckMap.set(duplicateKey, item);
  });

  // Process items from payload
  for (const it of items) {
    const itemObjectId = await convertToObjectId(it.itemId, 'Item');
    const totalBags = parseInt(it.totalBags, 10) || 0;
    const qualityGrade = (it.qualityGrade || '').trim();
    
    // Create duplicate check key
    const duplicateKey = `${itemObjectId.toString()}_${qualityGrade}`;

    const updateData = {
      itemId: itemObjectId,
      totalBags,
      qualityGrade: qualityGrade || null,
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
    
    // If item has an ID (existing item being updated)
    if (refId && existingMap.has(refId.toString())) {
      const existing = existingMap.get(refId.toString());
      Object.assign(existing, updateData);
      if (typeof updateData.remainingBags === 'undefined' && (!existing.remainingBags || existing.remainingBags < 0)) {
        existing.remainingBags = totalBags;
      }
      await existing.save();
    } 
    // Check for duplicate (same itemId + qualityGrade) - skip if duplicate
    else if (duplicateCheckMap.has(duplicateKey)) {
      // Duplicate item found - skip adding it
      console.log(`Skipping duplicate item: itemId=${itemObjectId}, qualityGrade=${qualityGrade}`);
      continue; // Skip this item, don't create duplicate
    }
    // New item - add it
    else {
      const laadItem = new LaadItem({
        laadId: laad._id,
        ...updateData,
        remainingBags: typeof updateData.remainingBags === 'number' ? updateData.remainingBags : totalBags
      });
      await laadItem.save();
      // Add to duplicate check map to prevent duplicates in same batch
      duplicateCheckMap.set(duplicateKey, laadItem);
    }
  }

  return exports.getLaadById(laad._id);
};

exports.deleteLaad = async (id) => {
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

  // Delete all associated LaadItems first
  await LaadItem.deleteMany({ laadId: laad._id });

  // Delete the laad
  await Laad.findByIdAndDelete(laad._id);

  return { message: 'Laad and associated items deleted successfully' };
};