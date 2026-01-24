const Sale = require('../models/Sale');
const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const LaadItem = require('../models/LaadItem');
const Item = require('../models/Item');
const Laad = require('../models/Laad');
const Supplier = require('../models/Supplier');
const TruckArrivalEntry = require('../models/TruckArrivalEntry');
const { convertToObjectId } = require('../utils/convertId');

// Detect whether current MongoDB connection supports transactions.
// Transactions require a replica set member or mongos. Standalone MongoDB will not support them.
let _supportsTransactionsCache = null;
async function supportsMongoTransactions() {
  if (process.env.DISABLE_MONGO_TRANSACTIONS === 'true') return false;
  if (_supportsTransactionsCache !== null) return _supportsTransactionsCache;

  try {
    const db = mongoose.connection?.db;
    if (!db) {
      _supportsTransactionsCache = false;
      return _supportsTransactionsCache;
    }

    // "hello" works on modern MongoDB versions (fallback to isMaster for older ones).
    const admin = db.admin();
    const hello =
      (await admin.command({ hello: 1 }).catch(() => null)) ||
      (await admin.command({ isMaster: 1 }).catch(() => null));

    if (!hello) {
      _supportsTransactionsCache = false;
      return _supportsTransactionsCache;
    }

    // Replica set member -> setName present. Mongos -> msg: "isdbgrid"
    _supportsTransactionsCache =
      Boolean(hello.setName) || hello.msg === 'isdbgrid';

    return _supportsTransactionsCache;
  } catch (e) {
    _supportsTransactionsCache = false;
    return _supportsTransactionsCache;
  }
}

const toId = (doc) => {
  if (!doc) return null;
  return doc.id || doc._id?.toString() || null;
};

const formatLaadItem = (laadItemDoc) => {
  if (!laadItemDoc) return null;

  return {
    id: toId(laadItemDoc),
    totalBags: laadItemDoc.totalBags ?? null,
    remainingBags: laadItemDoc.remainingBags ?? 0,
    qualityGrade: laadItemDoc.qualityGrade || null,
    item: laadItemDoc.itemId
      ? {
          id: toId(laadItemDoc.itemId),
          name: laadItemDoc.itemId.name || 'Unknown',
          quality: laadItemDoc.itemId.quality || '',
        }
      : null,
    laad: laadItemDoc.laadId
      ? {
          id: toId(laadItemDoc.laadId),
          laadNumber: laadItemDoc.laadId.laadNumber || '',
          supplier: laadItemDoc.laadId.supplierId
            ? {
                name: laadItemDoc.laadId.supplierId.name || 'Unknown',
              }
            : { name: 'Unknown' },
        }
      : null,
  };
};

const formatSale = (saleDoc) => {
  if (!saleDoc) return null;

  const formatted = {
    ...saleDoc,
    id: toId(saleDoc),
  };

  formatted.customer = saleDoc.customerId
    ? {
        id: toId(saleDoc.customerId),
        name: saleDoc.customerId.name || '',
        contact: saleDoc.customerId.contact || null,
      }
    : null;

  // New unified shape (multi-item sale order)
  if (Array.isArray(saleDoc.items) && saleDoc.items.length > 0) {
    const items = saleDoc.items.map((line) => {
      const laadItemDoc = line.laadItemId;
      const laadItemId =
        typeof laadItemDoc === 'object'
          ? toId(laadItemDoc)
          : laadItemDoc?.toString?.() || null;

      return {
        ...line,
        laadItemId,
        laadItem: laadItemDoc ? formatLaadItem(laadItemDoc) : null,
      };
    });

    const totalBags =
      typeof saleDoc.totalBags === 'number'
        ? saleDoc.totalBags
        : items.reduce((sum, i) => sum + (i.bagsSold || 0), 0);
    const totalWeight =
      typeof saleDoc.totalWeight === 'number'
        ? saleDoc.totalWeight
        : items.reduce((sum, i) => sum + (i.bagsSold || 0) * (i.bagWeight || 0), 0);

    return {
      ...formatted,
      items,
      laadItem: null,
      laadNumber: null,
      // For backward compatibility with UI expecting bagsSold,
      // we expose totalBags in bagsSold when this is a multi-item order.
      bagsSold: totalBags,
      bagWeight: null,
      totalBags,
      totalWeight,
      isMixOrder: true,
    };
  }

  formatted.laadItem = saleDoc.laadItemId
    ? formatLaadItem(saleDoc.laadItemId)
    : null;

  return formatted;
};

async function createSingleSale(payload) {
  const { 
    customerId, 
    laadItemId, 
    bagsSold, 
    bagWeight,
    qualityGrade, 
    ratePerBag,
    laadNumber,
    truckNumber,
    address,
    date,
    gatePassNumber
  } = payload;
  
  if (!customerId || !laadItemId || !Number.isInteger(bagsSold) || !bagWeight) {
    const e = new Error('customerId, laadItemId, integer bagsSold and bagWeight are required');
    e.status = 400; 
    throw e;
  }

  if (bagsSold <= 0) {
    const e = new Error('bagsSold must be greater than 0');
    e.status = 400; 
    throw e;
  }

  if (bagWeight <= 0) {
    const e = new Error('bagWeight must be greater than 0');
    e.status = 400; 
    throw e;
  }

  try {
    // Convert numeric IDs to ObjectIds
    const customerObjectId = await convertToObjectId(customerId, 'Customer');
    const laadItemObjectId = await convertToObjectId(laadItemId, 'LaadItem');

    // Check if customer exists
    const customer = await Customer.findById(customerObjectId);
    if (!customer) {
      const e = new Error(`Customer with ID ${customerId} not found`);
      e.status = 404; 
      throw e;
    }

    // First, get the selected LaadItem to find matching items
    const selectedLaadItem = await LaadItem.findById(laadItemObjectId)
      .populate('itemId')
      .populate('laadId')
      .lean();
    
    if (!selectedLaadItem) {
      const e = new Error(`LaadItem ${laadItemId} not found`);
      e.status = 404; 
      throw e;
    }

    // If selected LaadItem doesn't have enough stock, find all matching LaadItems
    // (same itemId + qualityGrade + laadId) and use the best one
    let laadItem = null;
    let finalLaadItemId = laadItemObjectId;
    
    if (selectedLaadItem.remainingBags >= bagsSold) {
      // Selected item has enough stock - use it
      laadItem = await LaadItem.findOneAndUpdate(
        { _id: laadItemObjectId, remainingBags: { $gte: bagsSold } },
        { $inc: { remainingBags: -bagsSold } },
        { new: true }
      ).populate('laadId');
      
      if (!laadItem) {
        const e = new Error(`Insufficient stock for LaadItem ${laadItemId}`);
        e.status = 400; 
        throw e;
      }
    } else {
      // Selected item doesn't have enough - find all matching LaadItems
      // Match by: same laadId + same item name + same qualityGrade
      const qualityGrade = (selectedLaadItem.qualityGrade || '').trim();
      const itemName = (selectedLaadItem.itemId?.name || '').trim().toLowerCase();
      
      // First, find all LaadItems in the same laad
      const allLaadItemsInLaad = await LaadItem.find({
        laadId: selectedLaadItem.laadId,
        remainingBags: { $gt: 0 }
      })
        .populate('itemId')
        .lean();
      
      // Filter to match by item name + qualityGrade (not by itemId)
      const matchingLaadItems = allLaadItemsInLaad.filter(item => {
        const itemItemName = (item.itemId?.name || '').trim().toLowerCase();
        const itemQualityGrade = (item.qualityGrade || '').trim();
        return itemItemName === itemName && itemQualityGrade === qualityGrade;
      });
      
      // Sort by remainingBags (most stock first)
      matchingLaadItems.sort((a, b) => (b.remainingBags || 0) - (a.remainingBags || 0));
      
      // Calculate total available stock from all matching items
      let totalAvailable = matchingLaadItems.reduce((sum, item) => sum + (item.remainingBags || 0), 0);
      
      // Also include DUPLICATE_SKIPPED items from TruckArrivalEntry that match this item
      // These are bags that were skipped but should still be available for sale
      let skippedBagsTotal = 0;
      const laadIdForSkipped = selectedLaadItem.laadId?._id || selectedLaadItem.laadId;
      if (laadIdForSkipped) {
        const truckArrivalEntries = await TruckArrivalEntry.find({
          laadId: laadIdForSkipped
        })
          .populate('items.itemId')
          .lean();
        
        truckArrivalEntries.forEach((entry) => {
          if (!entry.items || entry.items.length === 0) return;
          
          entry.items.forEach((entryItem) => {
            // Only count DUPLICATE_SKIPPED items
            if (entryItem.status !== 'DUPLICATE_SKIPPED') return;
            if (!entryItem.itemId) return;
            
            const entryItemId = entryItem.itemId._id?.toString() || entryItem.itemId.toString();
            const selectedItemId = selectedLaadItem.itemId._id?.toString() || selectedLaadItem.itemId.toString();
            
            // Match by item ID and quality grade
            if (entryItemId === selectedItemId) {
              const entryQualityGrade = (entryItem.qualityGrade || '').trim();
              const selectedQualityGrade = (selectedLaadItem.qualityGrade || '').trim();
              
              if (entryQualityGrade === selectedQualityGrade) {
                // This skipped item matches - add its bags to available stock
                const skippedBags = parseInt(entryItem.totalBags) || 0;
                skippedBagsTotal += skippedBags;
                totalAvailable += skippedBags;
              }
            }
          });
        });
      }
      
      if (totalAvailable < bagsSold) {
        const e = new Error(`Insufficient stock. Available: ${totalAvailable} bags, Requested: ${bagsSold} bags`);
        e.status = 400; 
        throw e;
      }
      
      // If we have skipped bags, add them to the best matching LaadItem first
      // This ensures the LaadItem has enough stock for the sale
      if (skippedBagsTotal > 0 && matchingLaadItems.length > 0) {
        // Find the best LaadItem (one with most stock)
        let bestItemForSkipped = matchingLaadItems[0];
        for (const item of matchingLaadItems) {
          if (item.remainingBags > bestItemForSkipped.remainingBags) {
            bestItemForSkipped = item;
          }
        }
        
        // Add skipped bags to this LaadItem
        await LaadItem.findByIdAndUpdate(
          bestItemForSkipped._id,
          {
            $inc: {
              remainingBags: skippedBagsTotal,
              totalBags: skippedBagsTotal
            }
          }
        );
        
        // Refresh matching items to get updated remainingBags
        const refreshedItems = await LaadItem.find({
          laadId: selectedLaadItem.laadId,
          remainingBags: { $gt: 0 }
        })
          .populate('itemId')
          .lean();
        
        // Re-filter and update matchingLaadItems
        matchingLaadItems.length = 0;
        refreshedItems.forEach(item => {
          const itemItemName = (item.itemId?.name || '').trim().toLowerCase();
          const itemQualityGrade = (item.qualityGrade || '').trim();
          if (itemItemName === itemName && itemQualityGrade === qualityGrade) {
            matchingLaadItems.push(item);
          }
        });
        
        // Re-sort
        matchingLaadItems.sort((a, b) => (b.remainingBags || 0) - (a.remainingBags || 0));
      }
      
      // Find the best LaadItem to use (one with enough stock, or the one with most stock)
      let bestItem = null;
      let remainingBagsToSell = bagsSold;
      
      for (const item of matchingLaadItems) {
        if (item.remainingBags >= bagsSold) {
          // This item has enough stock - use it
          bestItem = item;
          remainingBagsToSell = bagsSold;
          break;
        } else if (!bestItem || item.remainingBags > bestItem.remainingBags) {
          // Track the item with most stock as fallback
          bestItem = item;
        }
      }
      
      if (!bestItem) {
        const e = new Error(`No suitable LaadItem found for sale`);
        e.status = 400; 
        throw e;
      }
      
      // Use the best item for the sale
      finalLaadItemId = bestItem._id;
      const bagsToSellFromBest = Math.min(bagsSold, bestItem.remainingBags);
      
      laadItem = await LaadItem.findOneAndUpdate(
        { _id: bestItem._id, remainingBags: { $gte: bagsToSellFromBest } },
        { $inc: { remainingBags: -bagsToSellFromBest } },
        { new: true }
      ).populate('laadId');
      
      if (!laadItem) {
        const e = new Error(`Failed to update stock for LaadItem ${bestItem._id}`);
      e.status = 400; 
      throw e;
      }
      
      // If we need more bags, update other matching items
      remainingBagsToSell = bagsSold - bagsToSellFromBest;
      if (remainingBagsToSell > 0) {
        for (const item of matchingLaadItems) {
          if (item._id.toString() === bestItem._id.toString()) continue; // Skip the one we already used
          
          const bagsFromThisItem = Math.min(remainingBagsToSell, item.remainingBags);
          if (bagsFromThisItem > 0) {
            await LaadItem.findOneAndUpdate(
              { _id: item._id, remainingBags: { $gte: bagsFromThisItem } },
              { $inc: { remainingBags: -bagsFromThisItem } }
            );
            remainingBagsToSell -= bagsFromThisItem;
            if (remainingBagsToSell <= 0) break;
          }
        }
      }
    }

    // Auto-calculate totalAmount if ratePerBag is provided
    const totalAmount = ratePerBag && bagsSold 
      ? parseFloat(ratePerBag) * bagsSold
      : null;

    // Get laadNumber and broker name from laadItem if not provided
    let finalLaadNumber = laadNumber;
    let brokerName = payload.brokerName || null;
    
    if (laadItem.laadId) {
      const laad = await Laad.findById(laadItem.laadId)
        .populate('supplierId');
      
      if (laad) {
        if (!finalLaadNumber) {
          finalLaadNumber = laad.laadNumber;
        }
        // Get broker name from supplier if not provided
        if (!brokerName && laad.supplierId) {
          brokerName = laad.supplierId.name;
        }
      }
    }

    // Get item details for analytics
    const populatedLaadItem = await LaadItem.findById(finalLaadItemId).populate('itemId');
    const itemName = populatedLaadItem?.itemId?.name || 'Unknown Item';
    const itemCategory = populatedLaadItem?.itemId?.category || 'daal';

    // Create sale (use finalLaadItemId which may be different from selected if we found a better match)
    const sale = new Sale({
      customerId: customerObjectId,
      laadItemId: finalLaadItemId, // Use the actual LaadItem used for the sale
      bagsSold,
      bagWeight: parseFloat(bagWeight),
      ratePerBag: ratePerBag ? parseFloat(ratePerBag) : null,
      totalAmount: totalAmount,
      qualityGrade: qualityGrade || null,
      isMixOrder: false,
      laadNumber: finalLaadNumber,
      truckNumber: truckNumber || null,
      address: address || null,
      brokerName: brokerName || null,
      gatePassNumber: gatePassNumber || null,
      itemName,
      itemCategory,
      date: date ? new Date(date) : new Date()
    });

    await sale.save();

    // Populate and return
    const populatedSale = await Sale.findById(sale._id)
      .populate('customerId')
      .populate({
        path: 'laadItemId',
        populate: [
          {
            path: 'itemId',
            model: 'Item'
          },
          {
            path: 'laadId',
            populate: {
              path: 'supplierId',
              model: 'Supplier'
            }
          }
        ]
      })
      .lean();

    // Transform to match frontend expectations
    return formatSale(populatedSale);
  } catch (error) {
    throw error;
  }
}

async function createSaleOrderFromItems(payload) {
  const { customerId, items, qualityGrade, ratePerBag, gatePassNumber, date, address, truckNumber, brokerName } = payload;

  if (!customerId || !Array.isArray(items) || items.length === 0) {
    const e = new Error('customerId and items array are required');
    e.status = 400;
    throw e;
  }

  const customerObjectId = await convertToObjectId(customerId, 'Customer');
  const customer = await Customer.findById(customerObjectId);
  if (!customer) {
    const e = new Error(`Customer with ID ${customerId} not found`);
    e.status = 404;
    throw e;
  }

  // Use transactions when possible; otherwise do manual rollback
  let session = null;
  let useTransaction = false;

  const txSupported = await supportsMongoTransactions();
  if (txSupported) {
    session = await Sale.startSession();
    session.startTransaction();
    useTransaction = true;
  }

  const stockDeductions = []; // { laadItemId: ObjectId, bagsSold: number }
  let createdOrderId = null;

  try {
    const orderItems = [];
    let totalBags = 0;
    let totalWeight = 0;
    let totalAmount = 0;
    let hasAnyAmount = false;

    for (const line of items) {
      const lineLaadItemId = line?.laadItemId;
      const lineBags = parseInt(line?.bagsSold, 10);
      const lineBagWeight = parseFloat(line?.bagWeight);

      if (!lineLaadItemId || !Number.isInteger(lineBags) || lineBags <= 0) {
        const e = new Error('Each item must have laadItemId and positive integer bagsSold');
        e.status = 400;
        throw e;
      }

      if (!Number.isFinite(lineBagWeight) || lineBagWeight <= 0) {
        const e = new Error('Each item must have positive bagWeight');
        e.status = 400;
        throw e;
      }

      const laadItemObjectId = await convertToObjectId(lineLaadItemId, 'LaadItem');

      // NEW: Weight-based stock deduction
      // Calculate weight to deduct and update remaining bags accordingly
      const weightToDeduct = lineBags * lineBagWeight;
      
      // Get current laadItem to find original bag weight for calculation
      const currentLaadItem = await LaadItem.findById(laadItemObjectId);
      if (!currentLaadItem) {
        const e = new Error(`LaadItem ${lineLaadItemId} not found`);
        e.status = 404;
        throw e;
      }
      
      const originalBagWeight = currentLaadItem.weightPerBag || currentLaadItem.itemId?.bagWeight || 50;
      const bagsToDeduct = Math.ceil(weightToDeduct / originalBagWeight); // Convert weight to equivalent bags
      
      // Atomic stock deduction using weight-based calculation
      const query = { _id: laadItemObjectId, remainingBags: { $gte: bagsToDeduct } };
      const update = { $inc: { remainingBags: -bagsToDeduct } };
      const opts = { new: true };

      const updatedLaadItem = useTransaction && session
        ? await LaadItem.findOneAndUpdate(query, update, opts).session(session)
        : await LaadItem.findOneAndUpdate(query, update, opts);

      if (!updatedLaadItem) {
        const e = new Error(`Insufficient stock for LaadItem ${lineLaadItemId}. Available: ${currentLaadItem.remainingBags} bags, Required: ${bagsToDeduct} bags (${weightToDeduct}kg)`);
        e.status = 400;
        throw e;
      }

      stockDeductions.push({ 
        laadItemId: laadItemObjectId, 
        bagsSold: lineBags,
        weightSold: weightToDeduct,
        bagsDeducted: bagsToDeduct
      });

      const effectiveRate =
        line?.ratePerBag !== undefined && line?.ratePerBag !== null && line?.ratePerBag !== ''
          ? parseFloat(line.ratePerBag)
          : (ratePerBag !== undefined && ratePerBag !== null && ratePerBag !== '' ? parseFloat(ratePerBag) : null);

      const lineTotalAmount =
        effectiveRate !== null && Number.isFinite(effectiveRate)
          ? effectiveRate * lineBags
          : null;

      if (lineTotalAmount !== null) {
        totalAmount += lineTotalAmount;
        hasAnyAmount = true;
      }

      totalBags += lineBags;
      // For display: If totalKantaWeight is entered, use it as total weight
      // Otherwise, use calculated weight (bags × bagWeight)
      const displayWeight = parseFloat(line?.totalKantaWeight) || 0;
      const calculatedWeight = lineBags * lineBagWeight;
      totalWeight += displayWeight > 0 ? displayWeight : calculatedWeight;

      // Get item details for analytics
      const populatedLaadItem = await LaadItem.findById(laadItemObjectId).populate('itemId');
      const itemName = populatedLaadItem?.itemId?.name || 'Unknown Item';
      const itemCategory = populatedLaadItem?.itemId?.category || 'daal';

      orderItems.push({
        laadItemId: laadItemObjectId,
        bagsSold: lineBags,
        bagWeight: lineBagWeight,
        totalKantaWeight: parseFloat(line?.totalKantaWeight) || 0,
        ratePerBag: effectiveRate !== null && Number.isFinite(effectiveRate) ? effectiveRate : null,
        totalAmount: lineTotalAmount,
        qualityGrade: line?.qualityGrade || qualityGrade || null,
        itemName,
        itemCategory
      });
    }

    // Get item details for analytics (use first item for main level)
    const firstItemDetails = await LaadItem.findById(orderItems[0].laadItemId).populate('itemId');
    const mainItemName = firstItemDetails?.itemId?.name || 'Unknown Item';
    const mainItemCategory = firstItemDetails?.itemId?.category || 'daal';

    const order = new Sale({
      customerId: customerObjectId,
      items: orderItems,
      isMixOrder: items.length > 1,
      // Backward-compatible aggregates (used by older reports/UI paths)
      bagsSold: totalBags,
      bagWeight: totalBags > 0 ? totalWeight / totalBags : null,
      totalBags,
      totalWeight,
      totalAmount: hasAnyAmount ? totalAmount : null,
      gatePassNumber: gatePassNumber || null,
      itemName: mainItemName, // For analytics
      itemCategory: mainItemCategory, // For analytics
      date: date ? new Date(date) : new Date(),
      address: address || null,
      truckNumber: truckNumber || null,
      brokerName: brokerName || null,
    });

    if (useTransaction && session) {
      await order.save({ session });
    } else {
      await order.save();
    }

    createdOrderId = order._id;

    if (useTransaction && session) {
      await session.commitTransaction();
    }

    // Populate and return
    const populated = await Sale.findById(order._id)
      .populate('customerId')
      .populate({
        path: 'items.laadItemId',
        populate: [
          { path: 'itemId', model: 'Item' },
          {
            path: 'laadId',
            populate: {
              path: 'supplierId',
              model: 'Supplier',
            },
          },
        ],
      })
      .lean();

    return formatSale(populated);
  } catch (error) {
    if (useTransaction && session) {
      try {
        await session.abortTransaction();
      } catch {
        // ignore
      }
    } else {
      // Manual rollback: delete created order (if created) and restore stock
      if (createdOrderId) {
        try {
          await Sale.findByIdAndDelete(createdOrderId);
        } catch {
          // ignore
        }
      }

      for (const d of stockDeductions) {
        try {
          await LaadItem.findByIdAndUpdate(d.laadItemId, { $inc: { remainingBags: d.bagsSold } });
        } catch {
          // ignore
        }
      }
    }

    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
}

exports.createSale = async (payload) => {
  // Unified API: allow items[] for both single and multi-item sales
  if (Array.isArray(payload?.items) && payload.items.length > 0) {
    // NEW: Always use weight-based createSaleOrderFromItems for consistency
    // This ensures weight-based calculations work for both single and multi-item sales
    return createSaleOrderFromItems(payload);
  }

  return createSingleSale(payload);
};

// Create mix order (multiple laad items)
exports.createMixOrder = async (payload) => {
  const { customerId, items, qualityGrade, ratePerBag, gatePassNumber, date, address, truckNumber, brokerName } = payload;
  
  if (!customerId || !Array.isArray(items) || items.length === 0) {
    const e = new Error('customerId and items array are required');
    e.status = 400; 
    throw e;
  }

  // Convert numeric customerId to ObjectId
  const customerObjectId = await convertToObjectId(customerId, 'Customer');
  
  // Check if customer exists
  const customer = await Customer.findById(customerObjectId);
  if (!customer) {
    const e = new Error(`Customer with ID ${customerId} not found`);
    e.status = 404; 
    throw e;
  }

  // Use MongoDB transactions only when supported (replica set / mongos).
  // For standalone MongoDB (common in local dev), we use manual rollback to keep data consistent.
  let session = null;
  let useTransaction = false;
  
  const txSupported = await supportsMongoTransactions();
  if (txSupported) {
    session = await Sale.startSession();
    session.startTransaction();
    useTransaction = true;
  }

  const sales = [];
  const mixOrderDetails = [];
  const laadItemsToRollback = []; // Track items for manual rollback if needed

  try {
    // Process each item in the mix order
    for (const item of items) {
      const { laadItemId, bagsSold, bagWeight, ratePerBag: itemRate } = item;
      
      if (!laadItemId || !Number.isInteger(bagsSold) || bagsSold <= 0) {
        const e = new Error('Each item must have laadItemId and positive bagsSold');
        e.status = 400; 
        throw e;
      }

      if (!bagWeight || bagWeight <= 0) {
        const e = new Error('Each item must have positive bagWeight');
        e.status = 400; 
        throw e;
      }

      // Convert numeric laadItemId to ObjectId
      const laadItemObjectId = await convertToObjectId(laadItemId, 'LaadItem');

      // Check if laadItem exists
      let laadItem;
      if (useTransaction && session) {
        laadItem = await LaadItem.findById(laadItemObjectId)
          .populate('itemId')
          .populate('laadId')
          .session(session);
      } else {
        laadItem = await LaadItem.findById(laadItemObjectId)
          .populate('itemId')
          .populate('laadId');
      }
      
      if (!laadItem) {
        const e = new Error(`LaadItem with ID ${laadItemId} not found`);
        e.status = 404; 
        throw e;
      }

      // Check stock availability
      if (laadItem.remainingBags < bagsSold) {
        const e = new Error(`Insufficient stock for LaadItem ${laadItemId}. Available: ${laadItem.remainingBags}, Requested: ${bagsSold}`);
        e.status = 400; 
        throw e;
      }

      // Auto-calculate totalAmount for this item
      const rate = itemRate || ratePerBag;
      const totalAmount = rate && bagsSold 
        ? parseFloat(rate) * bagsSold
        : null;

      // Create sale for this item
      const sale = new Sale({
        customerId: customerObjectId,
        laadItemId: laadItemObjectId,
        bagsSold,
        bagWeight: parseFloat(bagWeight),
        totalKantaWeight: parseFloat(item?.totalKantaWeight) || 0,
        ratePerBag: rate ? parseFloat(rate) : null,
        totalAmount: totalAmount,
        qualityGrade: qualityGrade || laadItem.qualityGrade || null,
        isMixOrder: true,
        gatePassNumber: gatePassNumber || null,
        date: date ? new Date(date) : new Date(),
        address: address || null,
        truckNumber: truckNumber || null,
        brokerName: brokerName || null,
        laadNumber: laadItem.laadId ? laadItem.laadId.laadNumber : null,
        mixOrderDetails: null // Will be updated after all sales are created
      });

      if (useTransaction && session) {
        await sale.save({ session });
      } else {
        await sale.save();
      }

      // Track for rollback
      laadItemsToRollback.push({
        laadItemId: laadItemObjectId,
        originalBags: laadItem.remainingBags,
        bagsSold: bagsSold
      });

      // Update remaining bags
      laadItem.remainingBags -= bagsSold;
      if (useTransaction && session) {
        await laadItem.save({ session });
      } else {
        await laadItem.save();
      }

      sales.push(sale);

      mixOrderDetails.push({
        saleId: sale._id.toString(),
        laadItemId: laadItemObjectId.toString(),
        bagsSold,
        bagWeight: parseFloat(bagWeight),
        totalKantaWeight: parseFloat(item?.totalKantaWeight) || 0,
        itemName: laadItem.itemId ? laadItem.itemId.name : 'Unknown',
        qualityGrade: laadItem.qualityGrade || null,
        laadNumber: laadItem.laadId ? laadItem.laadId.laadNumber : 'Unknown'
      });
    }

    // Update all sales with mix order details
    for (const sale of sales) {
      sale.mixOrderDetails = mixOrderDetails;
      if (useTransaction && session) {
        await sale.save({ session });
      } else {
        await sale.save();
      }
    }

    // Commit transaction if using transactions
    if (useTransaction && session) {
      await session.commitTransaction();
    }

    // Populate sales
    const populatedSales = await Promise.all(
      sales.map(sale => 
        Sale.findById(sale._id)
          .populate('customerId')
          .populate({
            path: 'laadItemId',
            populate: [
              { path: 'itemId', model: 'Item' },
              { path: 'laadId', model: 'Laad' }
            ]
          })
          .lean()
      )
    );

    return {
      sales: populatedSales,
      mixOrderDetails,
      totalBags: items.reduce((sum, item) => sum + item.bagsSold, 0)
    };
  } catch (error) {
    // Rollback: delete created sales and restore stock
    if (useTransaction && session) {
      try {
        await session.abortTransaction();
      } catch (abortError) {
        // Ignore abort errors
      }
    } else {
      // Manual rollback: delete sales and restore stock
      for (const sale of sales) {
        try {
          await Sale.findByIdAndDelete(sale._id);
        } catch (deleteError) {
          // Log but continue
          console.error('Error deleting sale during rollback:', deleteError);
        }
      }
      
      // Restore stock
      for (const item of laadItemsToRollback) {
        try {
          await LaadItem.findByIdAndUpdate(
            item.laadItemId,
            { $inc: { remainingBags: item.bagsSold } }
          );
        } catch (restoreError) {
          // Log but continue
          console.error('Error restoring stock during rollback:', restoreError);
        }
      }
    }
    
    throw error;
  } finally {
    if (session) {
      session.endSession();
    }
  }
};

exports.getSales = async (filters = {}) => {
  const { dateFrom, dateTo, customerId, laadNumber } = filters;
  
  const query = {};
  
  if (dateFrom || dateTo) {
    query.date = {};
    if (dateFrom) query.date.$gte = new Date(dateFrom);
    if (dateTo) query.date.$lte = new Date(dateTo);
  }
  
  if (customerId) {
    const customerObjectId = await convertToObjectId(customerId, 'Customer');
    query.customerId = customerObjectId;
  }
  
  if (laadNumber) {
    query.laadNumber = laadNumber;
  }

  const sales = await Sale.find(query)
    .sort({ date: -1 })
    .populate('customerId')
    .populate({
      path: 'laadItemId',
      populate: [
        {
          path: 'itemId',
          model: 'Item'
        },
        {
          path: 'laadId',
          populate: {
            path: 'supplierId',
            model: 'Supplier'
          }
        }
      ]
    })
    .populate({
      path: 'items.laadItemId',
      populate: [
        { path: 'itemId', model: 'Item' },
        {
          path: 'laadId',
          populate: {
            path: 'supplierId',
            model: 'Supplier',
          },
        },
      ],
    })
    .lean();

  // Transform to match frontend expectations
  return sales.map(formatSale);
};

exports.getSaleById = async (id) => {
  const sale = await Sale.findById(id)
    .populate('customerId')
    .populate({
      path: 'laadItemId',
      populate: [
        {
          path: 'itemId',
          model: 'Item'
        },
        {
          path: 'laadId',
          populate: {
            path: 'supplierId',
            model: 'Supplier'
          }
        }
      ]
    })
    .populate({
      path: 'items.laadItemId',
      populate: [
        { path: 'itemId', model: 'Item' },
        {
          path: 'laadId',
          populate: {
            path: 'supplierId',
            model: 'Supplier',
          },
        },
      ],
    })
    .lean();

  return formatSale(sale);
};

exports.getMixOrders = async () => {
  return await Sale.find({ isMixOrder: true })
    .sort({ date: -1 })
    .populate('customerId')
    .populate({
      path: 'laadItemId',
      populate: [
        { path: 'itemId', model: 'Item' },
        { path: 'laadId', model: 'Laad' }
      ]
    })
    .lean();
};

exports.updateSale = async (id, payload) => {
  const {
    customerId,
    laadItemId,
    bagsSold,
    bagWeight,
    ratePerBag,
    qualityGrade,
    laadNumber,
    truckNumber,
    address,
    brokerName,
    date,
    gatePassNumber,
    items,
  } = payload;

  const sale = await Sale.findById(id);
  if (!sale) {
    const e = new Error('Sale not found');
    e.status = 404;
    throw e;
  }

  // If this is our new "order" shape (items[]), allow editing via items[].
  const isOrder = Array.isArray(sale.items) && sale.items.length > 0;
  const wantsOrderUpdate = Array.isArray(items) && items.length > 0;

  // Legacy mix orders (old system) are still locked (multiple Sale docs with isMixOrder=true).
  if (sale.isMixOrder && !isOrder) {
    const e = new Error('Mix order sales cannot be edited individually');
    e.status = 400;
    throw e;
  }

  if (isOrder || wantsOrderUpdate) {
    if (!customerId || !Array.isArray(items) || items.length === 0) {
      const e = new Error('customerId and items array are required to update this sale order');
      e.status = 400;
      throw e;
    }

    // Validate items
    for (const line of items) {
      const lineBags = parseInt(line?.bagsSold, 10);
      const lineBagWeight = parseFloat(line?.bagWeight);
      if (!line?.laadItemId || !Number.isInteger(lineBags) || lineBags <= 0) {
        const e = new Error('Each item must have laadItemId and positive integer bagsSold');
        e.status = 400;
        throw e;
      }
      if (!Number.isFinite(lineBagWeight) || lineBagWeight <= 0) {
        const e = new Error('Each item must have positive bagWeight');
        e.status = 400;
        throw e;
      }
    }

    const customerObjectId = await convertToObjectId(customerId, 'Customer');

    // Transaction when possible, otherwise manual rollback
    let session = null;
    let useTransaction = false;
    const txSupported = await supportsMongoTransactions();
    if (txSupported) {
      session = await Sale.startSession();
      session.startTransaction();
      useTransaction = true;
    }

    const oldItems = Array.isArray(sale.items) ? sale.items : [];
    const stockUpdates = []; // Track all stock changes for rollback

    // Build a map of old items by ObjectId for exact matching
    // Use both ObjectId string and numeric ID for matching flexibility
    const oldItemsMap = new Map();
    const oldItemsMapByNumeric = new Map(); // For numeric ID matching
    
    for (const oldLine of oldItems) {
      if (!oldLine?.laadItemId || !oldLine?.bagsSold) continue;
      
      // Handle different formats of laadItemId:
      // 1. Object (populated from DB) - use _id or id
      // 2. String (ID from formatSale) - use as is
      // 3. Number (numeric ID) - use as is
      let oldIdObj = oldLine.laadItemId;
      if (typeof oldLine.laadItemId === 'object') {
        oldIdObj = oldLine.laadItemId._id || oldLine.laadItemId.id || oldLine.laadItemId;
      }
      
      const oldLaadItemObjectId = await convertToObjectId(oldIdObj, 'LaadItem');
      const oldIdStr = oldLaadItemObjectId.toString();
      
      // Store by ObjectId string
      oldItemsMap.set(oldIdStr, {
        laadItemId: oldLaadItemObjectId,
        bagsSold: oldLine.bagsSold
      });
      
      // Also store by numeric ID if available (for matching with numeric IDs from frontend)
      // Check both the original value and the converted ObjectId's numeric representation
      const originalId = typeof oldLine.laadItemId === 'object' 
        ? (oldLine.laadItemId.id || oldLine.laadItemId._id?.toString() || oldLine.laadItemId.toString())
        : oldLine.laadItemId;
      
      if (typeof originalId === 'number' || (typeof originalId === 'string' && /^\d+$/.test(originalId))) {
        const numericId = typeof originalId === 'number' ? originalId : parseInt(originalId, 10);
        oldItemsMapByNumeric.set(numericId, {
          laadItemId: oldLaadItemObjectId,
          bagsSold: oldLine.bagsSold
        });
      }
      
      // Also try to extract numeric ID from ObjectId if it's a numeric ObjectId
      // Some systems use numeric ObjectIds
      try {
        const objIdStr = oldLaadItemObjectId.toString();
        // If ObjectId string looks like it contains a number, try matching by that
        const numericMatch = objIdStr.match(/\d+/);
        if (numericMatch && numericMatch[0].length >= 3) {
          const extractedNum = parseInt(numericMatch[0], 10);
          if (!oldItemsMapByNumeric.has(extractedNum)) {
            oldItemsMapByNumeric.set(extractedNum, {
              laadItemId: oldLaadItemObjectId,
              bagsSold: oldLine.bagsSold
            });
          }
        }
      } catch (e) {
        // Ignore extraction errors
      }
    }

    try {
      let totalBags = 0;
      let totalWeight = 0;
      let totalAmountValue = 0;
      let hasAnyAmount = false;
      const normalizedItems = [];
      const processedOldItems = new Set(); // Track which old items we've processed

      // Process new items: calculate net changes and apply stock updates
      for (const line of items) {
        const newLaadItemId = await convertToObjectId(line.laadItemId, 'LaadItem');
        const lineBags = parseInt(line.bagsSold, 10);
        const lineBagWeight = parseFloat(line.bagWeight);
        const newIdStr = newLaadItemId.toString();

        // Check if this item existed in old sale
        // Try multiple matching strategies for robustness
        let oldItemData = oldItemsMap.get(newIdStr);
        
        // If not found by ObjectId string, try numeric ID matching
        if (!oldItemData) {
          if (typeof line.laadItemId === 'number') {
            oldItemData = oldItemsMapByNumeric.get(line.laadItemId);
          } else if (typeof line.laadItemId === 'string' && /^\d+$/.test(line.laadItemId)) {
            const numericId = parseInt(line.laadItemId, 10);
            oldItemData = oldItemsMapByNumeric.get(numericId);
          }
        }
        
        // If still not found, try matching by converting new ID to all possible formats
        if (!oldItemData) {
          // Try to find by comparing all old items' ObjectIds with new ObjectId
          for (const [oldIdStr, oldData] of oldItemsMap.entries()) {
            if (oldData.laadItemId.equals(newLaadItemId)) {
              oldItemData = oldData;
              break;
            }
          }
        }
        
        const oldBags = oldItemData ? oldItemData.bagsSold : 0;

        if (oldItemData) {
          processedOldItems.add(newIdStr);
        }

        // Handle stock update based on whether this is a new item or existing item
        if (oldBags === 0) {
          // New item (wasn't in old sale): deduct using weight-based calculation
          const weightToDeduct = lineBags * lineBagWeight;
          
          // Get current laadItem to find original bag weight for calculation
          const currentLaadItem = await LaadItem.findById(newLaadItemId);
          if (!currentLaadItem) {
            const e = new Error(`LaadItem ${line.laadItemId} not found`);
            e.status = 404;
            throw e;
          }
          
          const originalBagWeight = currentLaadItem.weightPerBag || currentLaadItem.itemId?.bagWeight || 50;
          const bagsToDeduct = Math.ceil(weightToDeduct / originalBagWeight); // Convert weight to equivalent bags
          
          const query = { _id: newLaadItemId, remainingBags: { $gte: bagsToDeduct } };
          const update = { $inc: { remainingBags: -bagsToDeduct } };
          const opts = { new: true };

          const updated = useTransaction && session
            ? await LaadItem.findOneAndUpdate(query, update, opts).session(session)
            : await LaadItem.findOneAndUpdate(query, update, opts);

          if (!updated) {
            const e = new Error(`Insufficient stock for LaadItem ${line.laadItemId}. ` +
              `Requested: ${lineBags} bags (${weightToDeduct}kg). ` +
              `Available: ${currentLaadItem.remainingBags} bags. ` +
              `Required: ${bagsToDeduct} bags equivalent.`);
            e.status = 400;
            throw e;
          }
          stockUpdates.push({ laadItemId: newLaadItemId, change: -bagsToDeduct, weightChange: -weightToDeduct });
        } else {
          // Existing item: calculate net change
          const netChange = lineBags - oldBags;

          if (netChange === 0) {
            // Same item, same quantity: no stock update needed
            // This handles the main use case: updating other fields (gate pass, etc.) without changing quantities
          } else if (netChange > 0) {
            // Increasing quantity: need to deduct additional bags using weight-based calculation
            const additionalWeight = netChange * lineBagWeight;
            
            // Get current laadItem to find original bag weight for calculation
            const currentLaadItem = await LaadItem.findById(newLaadItemId);
            if (!currentLaadItem) {
              const e = new Error(`LaadItem ${line.laadItemId} not found`);
              e.status = 404;
              throw e;
            }
            
            const originalBagWeight = currentLaadItem.weightPerBag || currentLaadItem.itemId?.bagWeight || 50;
            const bagsToDeduct = Math.ceil(additionalWeight / originalBagWeight); // Convert weight to equivalent bags
            
            // Current stock already has oldBags deducted, so we need:
            // current stock >= bagsToDeduct (the additional bags needed)
            const query = { _id: newLaadItemId, remainingBags: { $gte: bagsToDeduct } };
            const update = { $inc: { remainingBags: -bagsToDeduct } };
            const opts = { new: true };

            const updated = useTransaction && session
              ? await LaadItem.findOneAndUpdate(query, update, opts).session(session)
              : await LaadItem.findOneAndUpdate(query, update, opts);

            if (!updated) {
              const e = new Error(`Insufficient stock for LaadItem ${line.laadItemId}. ` +
                `Original sale had ${oldBags} bags. ` +
                `New quantity is ${lineBags} bags (need ${netChange} more bags = ${additionalWeight}kg). ` +
                `Available: ${currentLaadItem.remainingBags} bags. ` +
                `Required: ${bagsToDeduct} bags equivalent.`);
              e.status = 400;
              throw e;
            }
            stockUpdates.push({ laadItemId: newLaadItemId, change: -bagsToDeduct, weightChange: -additionalWeight });
          } else {
            // Decreasing quantity: need to restore some bags (netChange is negative)
            const restoreBags = Math.abs(netChange);
            const restoreWeight = restoreBags * lineBagWeight;
            
            // Get current laadItem to find original bag weight for calculation
            const currentLaadItem = await LaadItem.findById(newLaadItemId);
            const originalBagWeight = currentLaadItem?.weightPerBag || currentLaadItem?.itemId?.bagWeight || 50;
            const bagsToRestore = Math.floor(restoreWeight / originalBagWeight); // Convert weight to equivalent bags
            
            const inc = { $inc: { remainingBags: bagsToRestore } };
            
            if (useTransaction && session) {
              await LaadItem.findByIdAndUpdate(newLaadItemId, inc).session(session);
            } else {
              await LaadItem.findByIdAndUpdate(newLaadItemId, inc);
            }
            stockUpdates.push({ laadItemId: newLaadItemId, change: bagsToRestore, weightChange: restoreWeight });
          }
        }

        const effectiveRate =
          line?.ratePerBag !== undefined && line?.ratePerBag !== null && line?.ratePerBag !== ''
            ? parseFloat(line.ratePerBag)
            : null;
        const lineTotalAmount =
          effectiveRate !== null && Number.isFinite(effectiveRate)
            ? effectiveRate * lineBags
            : null;

        if (lineTotalAmount !== null) {
          totalAmountValue += lineTotalAmount;
          hasAnyAmount = true;
        }

        totalBags += lineBags;
        totalWeight += lineBags * lineBagWeight;

        normalizedItems.push({
          laadItemId: newLaadItemId,
          bagsSold: lineBags,
          bagWeight: lineBagWeight,
          ratePerBag: effectiveRate !== null && Number.isFinite(effectiveRate) ? effectiveRate : null,
          totalAmount: lineTotalAmount,
          qualityGrade: line?.qualityGrade || null,
        });
      }

      // Restore stock for items that were removed (exist in old but not in new)
      for (const [oldIdStr, oldItemData] of oldItemsMap.entries()) {
        if (!processedOldItems.has(oldIdStr)) {
          // This item was in old sale but removed in update - restore its stock
          const inc = { $inc: { remainingBags: oldItemData.bagsSold } };
          
          if (useTransaction && session) {
            await LaadItem.findByIdAndUpdate(oldItemData.laadItemId, inc).session(session);
          } else {
            await LaadItem.findByIdAndUpdate(oldItemData.laadItemId, inc);
          }
          stockUpdates.push({ laadItemId: oldItemData.laadItemId, change: oldItemData.bagsSold });
        }
      }

      sale.customerId = customerObjectId;
      sale.items = normalizedItems;
      sale.isMixOrder = normalizedItems.length > 1;
      sale.totalBags = totalBags;
      sale.totalWeight = totalWeight;
      sale.totalAmount = hasAnyAmount ? totalAmountValue : null;
      sale.bagsSold = totalBags; // backward-compat
      sale.bagWeight = totalBags > 0 ? totalWeight / totalBags : null; // backward-compat

      sale.truckNumber = truckNumber || null;
      sale.address = address || null;
      sale.brokerName = brokerName || null;
      sale.gatePassNumber = gatePassNumber || null;
      sale.date = date ? new Date(date) : sale.date;

      if (useTransaction && session) {
        await sale.save({ session });
        await session.commitTransaction();
      } else {
        await sale.save();
      }

      const updatedSale = await Sale.findById(sale._id)
        .populate('customerId')
        .populate({
          path: 'items.laadItemId',
          populate: [
            { path: 'itemId', model: 'Item' },
            {
              path: 'laadId',
              populate: { path: 'supplierId', model: 'Supplier' },
            },
          ],
        })
        .lean();

      return formatSale(updatedSale);
    } catch (err) {
      if (useTransaction && session) {
        try {
          await session.abortTransaction();
        } catch {
          // ignore
        }
      } else {
        // Manual rollback: reverse all stock changes
        for (const update of stockUpdates) {
          try {
            // Reverse the change: if we deducted, add back; if we restored, deduct again
            const reverseChange = update.change ? -update.change : -update.bagsSold;
            await LaadItem.findByIdAndUpdate(update.laadItemId, { $inc: { remainingBags: reverseChange } });
          } catch {
            // ignore rollback errors
          }
        }
      }
      throw err;
    } finally {
      if (session) session.endSession();
    }
  }

  // Legacy single-item update path
  if (!customerId || !laadItemId || !Number.isInteger(bagsSold) || bagsSold <= 0 || !bagWeight) {
    const e = new Error('customerId, laadItemId, positive integer bagsSold and bagWeight are required');
    e.status = 400;
    throw e;
  }

  if (bagWeight <= 0) {
    const e = new Error('bagWeight must be greater than 0');
    e.status = 400;
    throw e;
  }

  const customerObjectId = await convertToObjectId(customerId, 'Customer');
  const newLaadItemObjectId = await convertToObjectId(laadItemId, 'LaadItem');

  const currentLaadItem = await LaadItem.findById(sale.laadItemId);
  if (!currentLaadItem) {
    const e = new Error('Existing laad item not found');
    e.status = 404;
    throw e;
  }

  const targetLaadItem = await LaadItem.findById(newLaadItemObjectId).populate('laadId');
  if (!targetLaadItem) {
    const e = new Error('Selected laad item not found');
    e.status = 404;
    throw e;
  }

  const sameLaadItem = currentLaadItem._id.equals(newLaadItemObjectId);

  if (sameLaadItem) {
    const available = currentLaadItem.remainingBags + sale.bagsSold;
    if (bagsSold > available) {
      const e = new Error(`Insufficient stock. Available: ${available}, Requested: ${bagsSold}`);
      e.status = 400;
      throw e;
    }
    currentLaadItem.remainingBags = available - bagsSold;
    await currentLaadItem.save();
  } else {
    // restore previous stock
    currentLaadItem.remainingBags += sale.bagsSold;
    await currentLaadItem.save();

    if (targetLaadItem.remainingBags < bagsSold) {
      const e = new Error(`Insufficient stock. Available: ${targetLaadItem.remainingBags}, Requested: ${bagsSold}`);
      e.status = 400;
      throw e;
    }

    targetLaadItem.remainingBags -= bagsSold;
    await targetLaadItem.save();
  }

  let finalLaadNumber = laadNumber || sale.laadNumber || null;
  let finalBrokerName = brokerName || sale.brokerName || null;

  if (targetLaadItem.laadId) {
    const fullLaad = await Laad.findById(targetLaadItem.laadId)
      .populate('supplierId');
    if (fullLaad) {
      if (!finalLaadNumber) {
        finalLaadNumber = fullLaad.laadNumber;
      }
      if (!finalBrokerName && fullLaad.supplierId) {
        finalBrokerName = fullLaad.supplierId.name;
      }
    }
  }

  const parsedRate =
    ratePerBag === null || ratePerBag === undefined || ratePerBag === ''
      ? null
      : parseFloat(ratePerBag);
  const totalAmount = parsedRate && bagsSold ? parsedRate * bagsSold : null;

  sale.customerId = customerObjectId;
  sale.laadItemId = newLaadItemObjectId;
  sale.bagsSold = bagsSold;
  sale.bagWeight = parseFloat(bagWeight);
  sale.ratePerBag = parsedRate;
  sale.totalAmount = totalAmount;
  sale.qualityGrade = qualityGrade || null;
  sale.laadNumber = finalLaadNumber;
  sale.truckNumber = truckNumber || null;
  sale.address = address || null;
  sale.brokerName = finalBrokerName;
  sale.gatePassNumber = gatePassNumber || null;
  sale.date = date ? new Date(date) : sale.date;

  await sale.save();

  const updatedSale = await Sale.findById(sale._id)
    .populate('customerId')
    .populate({
      path: 'laadItemId',
      populate: [
        {
          path: 'itemId',
          model: 'Item',
        },
        {
          path: 'laadId',
          populate: {
            path: 'supplierId',
            model: 'Supplier',
          },
        },
      ],
    })
    .lean();

  return formatSale(updatedSale);
};

exports.getSalesAnalytics = async (filters = {}) => {
  const { category, dateRange } = filters;
  
  // Build date filter
  let dateFilter = {};
  if (dateRange && dateRange !== 'all') {
    const now = new Date();
    let startDate = new Date();
    
    switch (dateRange) {
      case '7days':
        startDate.setDate(now.getDate() - 7);
        break;
      case '30days':
        startDate.setDate(now.getDate() - 30);
        break;
      case '90days':
        startDate.setDate(now.getDate() - 90);
        break;
    }
    
    dateFilter = {
      date: {
        $gte: startDate,
        $lte: now
      }
    };
  }
  
  // Build match stage for aggregation
  const matchStage = {
    ...dateFilter
  };
  
  // Add category filter if specified
  if (category && category !== 'all') {
    matchStage.itemCategory = category;
  }
  
  // Aggregation pipeline - simplified to use itemCategory field
  const pipeline = [
    {
      $match: matchStage
    },
    {
      $lookup: {
        from: 'customers',
        localField: 'customerId',
        foreignField: '_id',
        as: 'customer'
      }
    },
    {
      $unwind: {
        path: '$customer',
        preserveNullAndEmptyArrays: true
      }
    }
  ];
  
  // Add group stage for summary
  const summaryPipeline = [...pipeline, {
    $group: {
      _id: null,
      totalSales: { $sum: 1 },
      totalBags: { $sum: '$bagsSold' },
      daalSales: {
        $sum: {
          $cond: [
            { $eq: ['$itemCategory', 'daal'] },
            1,
            0
          ]
        }
      },
      channaSales: {
        $sum: {
          $cond: [
            { $eq: ['$itemCategory', 'channa'] },
            1,
            0
          ]
        }
      }
    }
  }];
  
  // Add project stage for sales data
  const salesPipeline = [...pipeline, {
    $project: {
      id: '$id',
      date: '$date',
      bagsSold: '$bagsSold',
      itemName: '$itemName',
      itemCategory: '$itemCategory',
      customerName: '$customer.name',
      brokerName: '$brokerName',
      qualityGrade: '$qualityGrade',
      laadNumber: '$laadNumber',
      bagWeight: '$bagWeight',
      totalWeight: { $multiply: ['$bagsSold', '$bagWeight'] }
    }
  }, {
    $sort: { date: -1 }
  }];
  
  try {
    // Execute both aggregations
    const [summaryResult, salesResult] = await Promise.all([
      Sale.aggregate(summaryPipeline),
      Sale.aggregate(salesPipeline)
    ]);
    
    // Extract summary data
    const summary = summaryResult[0] || {
      totalSales: 0,
      totalBags: 0,
      totalRevenue: 0,
      daalSales: 0,
      channaSales: 0,
      daalRevenue: 0,
      channaRevenue: 0
    };
    
    return {
      summary,
      sales: salesResult
    };
  } catch (error) {
    console.error('Error in getSalesAnalytics:', error);
    throw error;
  }
};
