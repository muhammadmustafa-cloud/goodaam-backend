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
      let laadItem = null;
      
      // Check for duplicate - SUM UP if already exists in laad (same item + same quality)
      if (duplicateCheckMap.has(duplicateKey)) {
        // Existing item found - UPDATE it by adding new bags
        const existingItem = duplicateCheckMap.get(duplicateKey);
        const newBags = parseInt(it.totalBags) || 0;
        const existingTotalBags = existingItem.totalBags || 0;
        const existingRemainingBags = existingItem.remainingBags || 0;
        
        // Sum up the bags
        existingItem.totalBags = existingTotalBags + newBags;
        existingItem.remainingBags = existingRemainingBags + newBags; // Add to remaining as well
        
        // Update weight if provided (use average or new value if existing is null)
        if (it.weightPerBag) {
          // If existing weight is null, use new weight
          // If both exist, keep existing (or could calculate weighted average)
          if (!existingItem.weightPerBag) {
            existingItem.weightPerBag = parseFloat(it.weightPerBag);
          }
        }
        
        // Update weight from Jacobabad if provided
        if (it.weightFromJacobabad) {
          const newWeight = parseFloat(it.weightFromJacobabad);
          const existingWeight = existingItem.weightFromJacobabad || 0;
          existingItem.weightFromJacobabad = existingWeight + newWeight; // Sum weights
        }
        
        // Update Faisalabad weight if provided
        if (it.faisalabadWeight) {
          const newWeight = parseFloat(it.faisalabadWeight);
          const existingWeight = existingItem.faisalabadWeight || 0;
          existingItem.faisalabadWeight = existingWeight + newWeight; // Sum weights
        }
        
        // Update rate if provided (use new rate if existing is null, or keep existing)
        if (it.ratePerBag && !existingItem.ratePerBag) {
          existingItem.ratePerBag = parseFloat(it.ratePerBag);
        }
        
        // Recalculate totalAmount
        if (existingItem.ratePerBag && existingItem.totalBags) {
          existingItem.totalAmount = parseFloat(existingItem.ratePerBag) * existingItem.totalBags;
        }
        
        // Save updated item
        await existingItem.save();
        laadItem = existingItem;
        laadItemId = existingItem._id;
        laadItems.push(existingItem);
        itemStatus = 'UPDATED'; // Mark as updated instead of skipped
        
        console.log(`Updated existing item: ${itemName} - Quality: ${qualityGrade} - Added ${newBags} bags. New total: ${existingItem.totalBags} bags`);
      } else {
        // New item - create it
        // Auto-calculate totalAmount if ratePerBag is provided
        const totalAmount = it.ratePerBag && it.totalBags 
          ? parseFloat(it.ratePerBag) * parseInt(it.totalBags)
          : null;

        laadItem = new LaadItem({
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
      
      // Add to truck arrival entry items (track all items, including updates)
      truckArrivalItems.push({
        itemId: itemObjectId,
        itemName,
        itemQuality,
        totalBags: bags, // Bags added in this entry
        qualityGrade: qualityGrade || null,
        weightPerBag: it.weightPerBag ? parseFloat(it.weightPerBag) : null,
        weightFromJacobabad: it.weightFromJacobabad ? parseFloat(it.weightFromJacobabad) : null,
        faisalabadWeight: it.faisalabadWeight ? parseFloat(it.faisalabadWeight) : null,
        ratePerBag: it.ratePerBag ? parseFloat(it.ratePerBag) : null,
        totalAmount: it.ratePerBag && bags ? parseFloat(it.ratePerBag) * bags : null,
        status: itemStatus, // 'ADDED' for new items, 'UPDATED' for existing items
        laadItemId,
        // Store final totals after update (for audit trail)
        finalTotalBags: laadItem ? laadItem.totalBags : bags,
        finalRemainingBags: laadItem ? laadItem.remainingBags : (it.remainingBags ?? bags)
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

    // Count items by status for summary
    const itemsSummary = {
      added: truckArrivalItems.filter(item => item.status === 'ADDED').length,
      updated: truckArrivalItems.filter(item => item.status === 'UPDATED').length,
    };

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
      })),
      // Include summary for frontend
      itemsSummary: itemsSummary,
      truckArrivalEntry: {
        totalBags,
        totalWeight,
        itemsCount: truckArrivalItems.length,
      }
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
    // Check for duplicate (same itemId + qualityGrade) - SUM UP if duplicate
    else if (duplicateCheckMap.has(duplicateKey)) {
      // Duplicate item found - UPDATE it by adding new bags
      const existingItem = duplicateCheckMap.get(duplicateKey);
      const newBags = totalBags;
      const existingTotalBags = existingItem.totalBags || 0;
      const existingRemainingBags = existingItem.remainingBags || 0;
      
      // Sum up the bags
      existingItem.totalBags = existingTotalBags + newBags;
      existingItem.remainingBags = existingRemainingBags + newBags; // Add to remaining as well
      
      // Update weight if provided
      if (updateData.weightPerBag && !existingItem.weightPerBag) {
        existingItem.weightPerBag = updateData.weightPerBag;
      }
      
      // Update weight from Jacobabad if provided
      if (updateData.weightFromJacobabad) {
        const newWeight = updateData.weightFromJacobabad;
        const existingWeight = existingItem.weightFromJacobabad || 0;
        existingItem.weightFromJacobabad = existingWeight + newWeight; // Sum weights
      }
      
      // Update Faisalabad weight if provided
      if (updateData.faisalabadWeight) {
        const newWeight = updateData.faisalabadWeight;
        const existingWeight = existingItem.faisalabadWeight || 0;
        existingItem.faisalabadWeight = existingWeight + newWeight; // Sum weights
      }
      
      // Update rate if provided (use new rate if existing is null)
      if (updateData.ratePerBag && !existingItem.ratePerBag) {
        existingItem.ratePerBag = updateData.ratePerBag;
      }
      
      // Recalculate totalAmount
      if (existingItem.ratePerBag && existingItem.totalBags) {
        existingItem.totalAmount = parseFloat(existingItem.ratePerBag) * existingItem.totalBags;
      }
      
      // Save updated item
      await existingItem.save();
      console.log(`Updated existing item: itemId=${itemObjectId}, qualityGrade=${qualityGrade} - Added ${newBags} bags. New total: ${existingItem.totalBags} bags`);
      continue; // Continue to next item
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