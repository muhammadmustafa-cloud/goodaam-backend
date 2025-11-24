const Sale = require('../models/Sale');
const Customer = require('../models/Customer');
const LaadItem = require('../models/LaadItem');
const Item = require('../models/Item');
const Laad = require('../models/Laad');
const Supplier = require('../models/Supplier');
const { convertToObjectId } = require('../utils/convertId');

exports.createSale = async (payload) => {
  const { 
    customerId, 
    laadItemId, 
    bagsSold, 
    qualityGrade, 
    ratePerBag,
    laadNumber,
    truckNumber,
    address,
    date
  } = payload;
  
  if (!customerId || !laadItemId || !Number.isInteger(bagsSold)) {
    const e = new Error('customerId, laadItemId and integer bagsSold are required');
    e.status = 400; 
    throw e;
  }

  if (bagsSold <= 0) {
    const e = new Error('bagsSold must be greater than 0');
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

    // Check if laadItem exists
    const laadItem = await LaadItem.findById(laadItemObjectId)
      .populate('laadId');
    
    if (!laadItem) {
      const e = new Error(`LaadItem with ID ${laadItemId} not found`);
      e.status = 404; 
      throw e;
    }

    // Check stock availability
    if (laadItem.remainingBags < bagsSold) {
      const e = new Error(`Insufficient stock. Available: ${laadItem.remainingBags}, Requested: ${bagsSold}`);
      e.status = 400; 
      throw e;
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

    // Create sale
    const sale = new Sale({
      customerId: customerObjectId,
      laadItemId: laadItemObjectId,
      bagsSold,
      ratePerBag: ratePerBag ? parseFloat(ratePerBag) : null,
      totalAmount: totalAmount,
      qualityGrade: qualityGrade || null,
      isMixOrder: false,
      laadNumber: finalLaadNumber,
      truckNumber: truckNumber || null,
      address: address || null,
      brokerName: brokerName || null,
      date: date ? new Date(date) : new Date()
    });

    await sale.save();

    // Update remaining bags
    laadItem.remainingBags -= bagsSold;
    await laadItem.save();

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
    return {
      ...populatedSale,
      id: populatedSale.id || populatedSale._id.toString(),
      customer: populatedSale.customerId ? {
        id: populatedSale.customerId.id || populatedSale.customerId._id.toString(),
        name: populatedSale.customerId.name || '',
        contact: populatedSale.customerId.contact || null
      } : null,
      laadItem: populatedSale.laadItemId ? {
        id: populatedSale.laadItemId.id || populatedSale.laadItemId._id.toString(),
        item: populatedSale.laadItemId.itemId ? {
          id: populatedSale.laadItemId.itemId.id || populatedSale.laadItemId.itemId._id.toString(),
          name: populatedSale.laadItemId.itemId.name || 'Unknown',
          quality: populatedSale.laadItemId.itemId.quality || ''
        } : null,
        laad: populatedSale.laadItemId.laadId ? {
          id: populatedSale.laadItemId.laadId.id || populatedSale.laadItemId.laadId._id.toString(),
          laadNumber: populatedSale.laadItemId.laadId.laadNumber || '',
          supplier: populatedSale.laadItemId.laadId.supplierId ? {
            name: populatedSale.laadItemId.laadId.supplierId.name || 'Unknown'
          } : { name: 'Unknown' }
        } : null
      } : null
    };
  } catch (error) {
    throw error;
  }
};

// Create mix order (multiple laad items)
exports.createMixOrder = async (payload) => {
  const { customerId, items, qualityGrade, ratePerBag } = payload;
  
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
  return sales.map(sale => ({
    ...sale,
    id: sale.id || sale._id.toString(),
    customer: sale.customerId ? {
      id: sale.customerId.id || sale.customerId._id.toString(),
      name: sale.customerId.name || '',
      contact: sale.customerId.contact || null
    } : null,
    laadItem: sale.laadItemId ? {
      id: sale.laadItemId.id || sale.laadItemId._id.toString(),
      item: sale.laadItemId.itemId ? {
        id: sale.laadItemId.itemId.id || sale.laadItemId.itemId._id.toString(),
        name: sale.laadItemId.itemId.name || 'Unknown',
        quality: sale.laadItemId.itemId.quality || ''
      } : null,
      laad: sale.laadItemId.laadId ? {
        id: sale.laadItemId.laadId.id || sale.laadItemId.laadId._id.toString(),
        laadNumber: sale.laadItemId.laadId.laadNumber || '',
        supplier: sale.laadItemId.laadId.supplierId ? {
          name: sale.laadItemId.laadId.supplierId.name || 'Unknown'
        } : { name: 'Unknown' }
      } : null
    } : null
  }));
};

exports.getSaleById = async (id) => {
  return await Sale.findById(id)
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
