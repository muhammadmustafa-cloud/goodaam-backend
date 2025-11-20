const prisma = require('../config/prisma');

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
    e.status = 400; throw e;
  }

  if (bagsSold <= 0) {
    const e = new Error('bagsSold must be greater than 0');
    e.status = 400; throw e;
  }

  return await prisma.$transaction(async (tx) => {
    // Check if customer exists
    const customer = await tx.customer.findUnique({ 
      where: { id: customerId } 
    });
    if (!customer) {
      const e = new Error(`Customer with ID ${customerId} not found`);
      e.status = 404; throw e;
    }

    // Check if laadItem exists
    const laadItem = await tx.laadItem.findUnique({ 
      where: { id: laadItemId },
      include: { laad: true }
    });
    if (!laadItem) {
      const e = new Error(`LaadItem with ID ${laadItemId} not found`);
      e.status = 404; throw e;
    }

    // Check stock availability
    if (laadItem.remainingBags < bagsSold) {
      const e = new Error(`Insufficient stock. Available: ${laadItem.remainingBags}, Requested: ${bagsSold}`);
      e.status = 400; throw e;
    }

    // Auto-calculate totalAmount if ratePerBag is provided (optional for stock items)
    const totalAmount = ratePerBag && bagsSold 
      ? parseFloat(ratePerBag) * bagsSold
      : null;

    // Get laadNumber from laadItem if not provided
    const finalLaadNumber = laadNumber || laadItem.laad?.laadNumber || null;

    // Create sale
    const sale = await tx.sale.create({
      data: {
        customerId,
        laadItemId,
        bagsSold,
        ratePerBag: ratePerBag ? parseFloat(ratePerBag) : null,
        totalAmount: totalAmount,
        qualityGrade: qualityGrade || null,
        isMixOrder: false,
        laadNumber: finalLaadNumber,
        truckNumber: truckNumber || null,
        address: address || null,
        date: date ? new Date(date) : new Date()
      },
      include: {
        customer: true,
        laadItem: {
          include: {
            item: true,
            laad: {
              include: {
                supplier: true
              }
            }
          }
        }
      }
    });

    // Update remaining bags
    await tx.laadItem.update({
      where: { id: laadItemId },
      data: { remainingBags: { decrement: bagsSold } }
    });

    return sale;
  });
};

// Create mix order (multiple laad items)
exports.createMixOrder = async (payload) => {
  const { customerId, items, qualityGrade, ratePerBag } = payload;
  
  if (!customerId || !Array.isArray(items) || items.length === 0) {
    const e = new Error('customerId and items array are required');
    e.status = 400; throw e;
  }

  return await prisma.$transaction(async (tx) => {
    // Check if customer exists
    const customer = await tx.customer.findUnique({ 
      where: { id: customerId } 
    });
    if (!customer) {
      const e = new Error(`Customer with ID ${customerId} not found`);
      e.status = 404; throw e;
    }

    const sales = [];
    const mixOrderDetails = [];

    // Process each item in the mix order
    for (const item of items) {
      const { laadItemId, bagsSold, ratePerBag: itemRate } = item;
      
      if (!laadItemId || !Number.isInteger(bagsSold) || bagsSold <= 0) {
        const e = new Error('Each item must have laadItemId and positive bagsSold');
        e.status = 400; throw e;
      }

      // Check if laadItem exists
      const laadItem = await tx.laadItem.findUnique({ 
        where: { id: laadItemId } 
      });
      if (!laadItem) {
        const e = new Error(`LaadItem with ID ${laadItemId} not found`);
        e.status = 404; throw e;
      }

      // Check stock availability
      if (laadItem.remainingBags < bagsSold) {
        const e = new Error(`Insufficient stock for LaadItem ${laadItemId}. Available: ${laadItem.remainingBags}, Requested: ${bagsSold}`);
        e.status = 400; throw e;
      }

      // Auto-calculate totalAmount for this item
      const rate = itemRate || ratePerBag;
      const totalAmount = rate && bagsSold 
        ? parseFloat(rate) * bagsSold
        : null;

      // Create sale for this item
      const sale = await tx.sale.create({
        data: {
          customerId,
          laadItemId,
          bagsSold,
          ratePerBag: rate ? parseFloat(rate) : null,
          totalAmount: totalAmount,
          qualityGrade: qualityGrade || null,
          isMixOrder: true,
          mixOrderDetails: null // Will be updated after all sales are created
        },
        include: {
          customer: true,
          laadItem: {
            include: {
              item: true,
              laad: true
            }
          }
        }
      });

      sales.push(sale);
      mixOrderDetails.push({
        saleId: sale.id,
        laadItemId,
        bagsSold,
        itemName: sale.laadItem.item.name,
        laadNumber: sale.laadItem.laad.laadNumber
      });

      // Update remaining bags
      await tx.laadItem.update({
        where: { id: laadItemId },
        data: { remainingBags: { decrement: bagsSold } }
      });
    }

    // Update all sales with mix order details
    for (const sale of sales) {
      await tx.sale.update({
        where: { id: sale.id },
        data: { mixOrderDetails }
      });
    }

    return {
      sales,
      mixOrderDetails,
      totalBags: items.reduce((sum, item) => sum + item.bagsSold, 0)
    };
  });
};

exports.getSales = async (filters = {}) => {
  const { dateFrom, dateTo, customerId, laadNumber } = filters;
  
  const where = {};
  
  if (dateFrom || dateTo) {
    where.date = {};
    if (dateFrom) where.date.gte = new Date(dateFrom);
    if (dateTo) where.date.lte = new Date(dateTo);
  }
  
  if (customerId) {
    where.customerId = parseInt(customerId);
  }
  
  if (laadNumber) {
    where.laadNumber = laadNumber;
  }

  return prisma.sale.findMany({
    where,
    orderBy: { date: 'desc' },
    include: { 
      customer: true, 
      laadItem: { 
        include: { 
          item: true, 
          laad: {
            include: {
              supplier: true
            }
          }
        } 
      } 
    }
  });
};

exports.getSaleById = async (id) => {
  return prisma.sale.findUnique({
    where: { id: parseInt(id) },
    include: { 
      customer: true, 
      laadItem: { 
        include: { 
          item: true, 
          laad: {
            include: {
              supplier: true
            }
          }
        } 
      } 
    }
  });
};

exports.getMixOrders = async () => {
  return prisma.sale.findMany({
    where: { isMixOrder: true },
    orderBy: { date: 'desc' },
    include: { 
      customer: true, 
      laadItem: { 
        include: { 
          item: true, 
          laad: true 
        } 
      } 
    }
  });
};