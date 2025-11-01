const prisma = require('../config/prisma');

/**
 * Customer Ledger - Shows all transactions and outstanding balance (Baqaya)
 */
exports.getCustomerLedger = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { startDate, endDate } = req.query;

    // Get customer info
    const customer = await prisma.customer.findUnique({
      where: { id: parseInt(customerId) },
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    // Build date filter
    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    // Get all sales for this customer
    const sales = await prisma.sale.findMany({
      where: {
        customerId: parseInt(customerId),
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      },
      include: {
        laadItem: {
          include: {
            item: true,
            laad: {
              include: {
                supplier: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Calculate totals
    const totalBagsSold = sales.reduce((sum, sale) => sum + (sale.bagsSold || 0), 0);
    const totalAmount = sales.reduce((sum, sale) => {
      const amount = sale.totalAmount || (sale.bagsSold * (parseFloat(sale.ratePerBag) || 0));
      return sum + (parseFloat(amount) || 0);
    }, 0);

    // For demo: assuming 30% is paid, 70% is Baqaya (outstanding)
    // In real system, you'd track payments separately
    const estimatedPaid = (parseFloat(totalAmount) || 0) * 0.3;
    const baqaya = (parseFloat(totalAmount) || 0) - estimatedPaid;

    return res.json({
      success: true,
      data: {
        customer,
        summary: {
          totalSales: sales.length,
          totalBagsSold,
          totalAmount: parseFloat((totalAmount || 0).toFixed(2)),
          estimatedPaid: parseFloat((estimatedPaid || 0).toFixed(2)),
          baqaya: parseFloat((baqaya || 0).toFixed(2)),
        },
        transactions: sales.map(sale => ({
          id: sale.id,
          date: sale.createdAt,
          item: sale.laadItem.item.name,
          quality: sale.qualityGrade || sale.laadItem.qualityGrade,
          laadNumber: sale.laadItem.laad.laadNumber,
          bagsSold: sale.bagsSold,
          ratePerBag: parseFloat(sale.ratePerBag) || 0,
          totalAmount: parseFloat(sale.totalAmount) || sale.bagsSold * (parseFloat(sale.ratePerBag) || 0),
          isMixOrder: sale.isMixOrder,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching customer ledger:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch customer ledger',
    });
  }
};

/**
 * Supplier Ledger - Shows all purchases from supplier
 */
exports.getSupplierLedger = async (req, res) => {
  try {
    const { supplierId } = req.params;
    const { startDate, endDate } = req.query;

    // Get supplier info
    const supplier = await prisma.supplier.findUnique({
      where: { id: parseInt(supplierId) },
    });

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    // Build date filter
    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);

    // Get all laads from this supplier
    const laads = await prisma.laad.findMany({
      where: {
        supplierId: parseInt(supplierId),
        ...(Object.keys(dateFilter).length > 0 && { arrivalDate: dateFilter }),
      },
      include: {
        vehicle: true,
        items: {
          include: {
            item: true,
          },
        },
      },
      orderBy: {
        arrivalDate: 'desc',
      },
    });

    // Calculate totals
    const totalLaads = laads.length;
    const totalBagsPurchased = laads.reduce((sum, laad) => {
      return sum + laad.items.reduce((itemSum, item) => itemSum + item.totalBags, 0);
    }, 0);

    const totalAmount = laads.reduce((sum, laad) => {
      return sum + laad.items.reduce((itemSum, item) => {
        const amount = parseFloat(item.totalAmount) || 0;
        return itemSum + amount;
      }, 0);
    }, 0);

    return res.json({
      success: true,
      data: {
        supplier,
        summary: {
          totalLaads,
          totalBagsPurchased,
          totalAmount: parseFloat((totalAmount || 0).toFixed(2)),
        },
        transactions: laads.map(laad => {
          const laadItems = Array.isArray(laad.items) ? laad.items : [];
          return {
            id: laad.id,
            laadNumber: laad.laadNumber,
            arrivalDate: laad.arrivalDate,
            vehicle: laad.vehicle?.number || laad.vehicleNumber,
            itemsCount: laadItems.length,
            totalBags: laadItems.reduce((sum, item) => sum + (item.totalBags || 0), 0),
            totalAmount: laadItems.reduce((sum, item) => sum + (parseFloat(item.totalAmount) || 0), 0),
            items: laadItems.map(item => ({
              name: item.item?.name || 'Unknown',
              quality: item.qualityGrade || 'N/A',
              bags: item.totalBags || 0,
              ratePerBag: parseFloat(item.ratePerBag) || 0,
              amount: parseFloat(item.totalAmount) || 0,
            })),
          };
        }),
      },
    });
  } catch (error) {
    console.error('Error fetching supplier ledger:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch supplier ledger',
    });
  }
};

/**
 * Daily Sales Report
 */
exports.getDailySalesReport = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    
    // Set date range for the day
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all sales for the day
    const sales = await prisma.sale.findMany({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      include: {
        customer: true,
        laadItem: {
          include: {
            item: true,
            laad: true,
          },
        },
      },
    });

    // Calculate summary
    const totalSales = sales.length;
    const totalBagsSold = sales.reduce((sum, sale) => sum + sale.bagsSold, 0);
    const totalRevenue = sales.reduce((sum, sale) => {
      const amount = parseFloat(sale.totalAmount) || (sale.bagsSold * (parseFloat(sale.ratePerBag) || 0));
      return sum + amount;
    }, 0);

    // Group by customer
    const salesByCustomer = {};
    sales.forEach(sale => {
      const customerId = sale.customer.id;
      if (!salesByCustomer[customerId]) {
        salesByCustomer[customerId] = {
          customer: sale.customer.name,
          sales: 0,
          bags: 0,
          amount: 0,
        };
      }
      salesByCustomer[customerId].sales += 1;
      salesByCustomer[customerId].bags += sale.bagsSold;
      const amount = parseFloat(sale.totalAmount) || (sale.bagsSold * (parseFloat(sale.ratePerBag) || 0));
      salesByCustomer[customerId].amount += amount;
    });

    return res.json({
      success: true,
      data: {
        date: targetDate.toISOString().split('T')[0],
        summary: {
          totalSales,
          totalBagsSold,
          totalRevenue: parseFloat((totalRevenue || 0).toFixed(2)),
          uniqueCustomers: Object.keys(salesByCustomer).length,
        },
        salesByCustomer: Object.values(salesByCustomer),
        transactions: sales.map(sale => ({
          id: sale.id,
          time: sale.createdAt,
          customer: sale.customer.name,
          item: sale.laadItem.item.name,
          quality: sale.qualityGrade || sale.laadItem.qualityGrade,
          bags: sale.bagsSold,
          rate: parseFloat(sale.ratePerBag) || 0,
          amount: parseFloat(sale.totalAmount) || (sale.bagsSold * (parseFloat(sale.ratePerBag) || 0)),
          isMixOrder: sale.isMixOrder,
        })),
      },
    });
  } catch (error) {
    console.error('Error fetching daily sales report:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch daily sales report',
    });
  }
};

/**
 * Stock Movement History
 */
exports.getStockMovement = async (req, res) => {
  try {
    const { itemId, startDate, endDate } = req.query;

    // Build filters
    const laadFilter = {};
    const saleFilter = {};

    if (startDate) {
      laadFilter.arrivalDate = { gte: new Date(startDate) };
      saleFilter.createdAt = { gte: new Date(startDate) };
    }
    if (endDate) {
      laadFilter.arrivalDate = { ...laadFilter.arrivalDate, lte: new Date(endDate) };
      saleFilter.createdAt = { ...saleFilter.createdAt, lte: new Date(endDate) };
    }
    if (itemId) {
      laadFilter.items = { some: { itemId: parseInt(itemId) } };
      saleFilter.laadItem = { itemId: parseInt(itemId) };
    }

    // Get incoming stock (laads)
    const laads = await prisma.laad.findMany({
      where: laadFilter,
      include: {
        supplier: true,
        items: {
          where: itemId ? { itemId: parseInt(itemId) } : {},
          include: {
            item: true,
          },
        },
      },
      orderBy: {
        arrivalDate: 'desc',
      },
    });

    // Get outgoing stock (sales)
    const sales = await prisma.sale.findMany({
      where: saleFilter,
      include: {
        customer: true,
        laadItem: {
          include: {
            item: true,
            laad: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Combine and sort by date
    const movements = [];

    laads.forEach(laad => {
      laad.items.forEach(item => {
        movements.push({
          type: 'IN',
          date: laad.arrivalDate,
          reference: laad.laadNumber,
          party: laad.supplier.name,
          item: item.item.name,
          quality: item.qualityGrade,
          bags: item.totalBags,
          rate: parseFloat(item.ratePerBag) || 0,
          amount: parseFloat(item.totalAmount) || 0,
        });
      });
    });

    sales.forEach(sale => {
      movements.push({
        type: 'OUT',
        date: sale.createdAt,
        reference: `SALE-${sale.id}`,
        party: sale.customer.name,
        item: sale.laadItem.item.name,
        quality: sale.qualityGrade || sale.laadItem.qualityGrade,
        bags: sale.bagsSold,
        rate: parseFloat(sale.ratePerBag) || 0,
        amount: parseFloat(sale.totalAmount) || (sale.bagsSold * (parseFloat(sale.ratePerBag) || 0)),
      });
    });

    // Sort by date
    movements.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate running totals
    const totalIn = movements.filter(m => m.type === 'IN').reduce((sum, m) => sum + m.bags, 0);
    const totalOut = movements.filter(m => m.type === 'OUT').reduce((sum, m) => sum + m.bags, 0);
    const currentStock = totalIn - totalOut;

    return res.json({
      success: true,
      data: {
        summary: {
          totalIn,
          totalOut,
          currentStock,
        },
        movements,
      },
    });
  } catch (error) {
    console.error('Error fetching stock movement:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch stock movement',
    });
  }
};

/**
 * All customers summary for ledger overview
 */
exports.getAllCustomersLedger = async (req, res) => {
  try {
    const customers = await prisma.customer.findMany({
      include: {
        sales: {
          select: {
            bagsSold: true,
            totalAmount: true,
            ratePerBag: true,
          },
        },
      },
    });

    const ledgerData = customers.map(customer => {
      const totalSales = customer.sales.length;
      const totalBags = customer.sales.reduce((sum, sale) => sum + sale.bagsSold, 0);
      const totalAmount = customer.sales.reduce((sum, sale) => {
        const amount = parseFloat(sale.totalAmount) || (sale.bagsSold * (parseFloat(sale.ratePerBag) || 0));
        return sum + amount;
      }, 0);

      // Estimated Baqaya (70% of total)
      const baqaya = totalAmount * 0.7;

      return {
        id: customer.id,
        name: customer.name,
        contact: customer.contact,
        address: customer.address,
        totalSales,
        totalBags,
        totalAmount: parseFloat((totalAmount || 0).toFixed(2)),
        baqaya: parseFloat((baqaya || 0).toFixed(2)),
      };
    });

    return res.json({
      success: true,
      data: ledgerData,
    });
  } catch (error) {
    console.error('Error fetching all customers ledger:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch customers ledger',
    });
  }
};

/**
 * All suppliers summary
 */
exports.getAllSuppliersLedger = async (req, res) => {
  try {
    const suppliers = await prisma.supplier.findMany({
      include: {
        laads: {
          include: {
            items: true,
          },
        },
      },
    });

    const ledgerData = suppliers.map(supplier => {
      const totalLaads = supplier.laads.length;
      const totalBags = supplier.laads.reduce((sum, laad) => {
        return sum + laad.items.reduce((itemSum, item) => itemSum + item.totalBags, 0);
      }, 0);
      const totalAmount = supplier.laads.reduce((sum, laad) => {
        return sum + laad.items.reduce((itemSum, item) => {
          return itemSum + (parseFloat(item.totalAmount) || 0);
        }, 0);
      }, 0);

      return {
        id: supplier.id,
        name: supplier.name,
        contact: supplier.contact,
        address: supplier.address,
        totalLaads,
        totalBags,
        totalAmount: parseFloat((totalAmount || 0).toFixed(2)),
      };
    });

    return res.json({
      success: true,
      data: ledgerData,
    });
  } catch (error) {
    console.error('Error fetching all suppliers ledger:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch suppliers ledger',
    });
  }
};


