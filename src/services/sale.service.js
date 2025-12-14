const Sale = require('../models/Sale');
const Customer = require('../models/Customer');
const LaadItem = require('../models/LaadItem');
const Item = require('../models/Item');
const Laad = require('../models/Laad');
const Supplier = require('../models/Supplier');
const { convertToObjectId } = require('../utils/convertId');

const toId = (doc) => {
  if (!doc) return null;
  return doc.id || doc._id?.toString() || null;
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

  formatted.laadItem = saleDoc.laadItemId
    ? {
        id: toId(saleDoc.laadItemId),
        totalBags: saleDoc.laadItemId.totalBags ?? null,
        remainingBags: saleDoc.laadItemId.remainingBags ?? 0,
        qualityGrade: saleDoc.laadItemId.qualityGrade || null,
        item: saleDoc.laadItemId.itemId
          ? {
              id: toId(saleDoc.laadItemId.itemId),
              name: saleDoc.laadItemId.itemId.name || 'Unknown',
              quality: saleDoc.laadItemId.itemId.quality || '',
            }
          : null,
        laad: saleDoc.laadItemId.laadId
          ? {
              id: toId(saleDoc.laadItemId.laadId),
              laadNumber: saleDoc.laadItemId.laadId.laadNumber || '',
              supplier: saleDoc.laadItemId.laadId.supplierId
                ? {
                    name: saleDoc.laadItemId.laadId.supplierId.name || 'Unknown',
                  }
                : { name: 'Unknown' },
            }
          : null,
      }
    : null;

  return formatted;
};

exports.createSale = async (payload) => {
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
      const totalAvailable = matchingLaadItems.reduce((sum, item) => sum + (item.remainingBags || 0), 0);
      
      if (totalAvailable < bagsSold) {
        const e = new Error(`Insufficient stock. Available: ${totalAvailable} bags, Requested: ${bagsSold} bags`);
        e.status = 400; 
        throw e;
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
};

// Create mix order (multiple laad items)
exports.createMixOrder = async (payload) => {
  const { customerId, items, qualityGrade, ratePerBag, gatePassNumber } = payload;
  
  if (!customerId || !Array.isArray(items) || items.length === 0) {
    const e = new Error('customerId and items array are required');
    e.status = 400; 
    throw e;
  }

  // MongoDB session for transaction
  const session = await Sale.startSession();
  session.startTransaction();

  try {
    // Check if customer exists
    const customer = await Customer.findById(customerId).session(session);
    if (!customer) {
      const e = new Error(`Customer with ID ${customerId} not found`);
      e.status = 404; 
      throw e;
    }

    const sales = [];
    const mixOrderDetails = [];

    // Process each item in the mix order
    for (const item of items) {
      const { laadItemId, bagsSold, ratePerBag: itemRate } = item;
      
      if (!laadItemId || !Number.isInteger(bagsSold) || bagsSold <= 0) {
        const e = new Error('Each item must have laadItemId and positive bagsSold');
        e.status = 400; 
        throw e;
      }

      // Check if laadItem exists
      const laadItem = await LaadItem.findById(laadItemId)
        .populate('itemId')
        .populate('laadId')
        .session(session);
      
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
        customerId,
        laadItemId,
        bagsSold,
        ratePerBag: rate ? parseFloat(rate) : null,
        totalAmount: totalAmount,
        qualityGrade: qualityGrade || null,
        isMixOrder: true,
        gatePassNumber: gatePassNumber || null,
        mixOrderDetails: null // Will be updated after all sales are created
      });

      await sale.save({ session });

      // Update remaining bags
      laadItem.remainingBags -= bagsSold;
      await laadItem.save({ session });

      sales.push(sale);

      mixOrderDetails.push({
        saleId: sale._id.toString(),
        laadItemId: laadItemId.toString(),
        bagsSold,
        itemName: laadItem.itemId ? laadItem.itemId.name : 'Unknown',
        laadNumber: laadItem.laadId ? laadItem.laadId.laadNumber : 'Unknown'
      });
    }

    // Update all sales with mix order details
    for (const sale of sales) {
      sale.mixOrderDetails = mixOrderDetails;
      await sale.save({ session });
    }

    // Commit transaction
    await session.commitTransaction();

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
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
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
    query.customerId = customerId;
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
  } = payload;

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

  const sale = await Sale.findById(id);
  if (!sale) {
    const e = new Error('Sale not found');
    e.status = 404;
    throw e;
  }

  if (sale.isMixOrder) {
    const e = new Error('Mix order sales cannot be edited individually');
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
