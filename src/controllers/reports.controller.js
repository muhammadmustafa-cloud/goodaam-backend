const mongoose = require('mongoose');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const Sale = require('../models/Sale');
const Laad = require('../models/Laad');
const LaadItem = require('../models/LaadItem');
const Item = require('../models/Item');
const TruckArrivalEntry = require('../models/TruckArrivalEntry');

/**
 * Customer Ledger - Shows all transactions and outstanding balance (Baqaya)
 */
exports.getCustomerLedger = async (req, res) => {
  try {
    const { customerId } = req.params;
    const { startDate, endDate } = req.query;

    // Get customer info
    const customer = await Customer.findById(customerId);

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found',
      });
    }

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    // Get all sales for this customer
    const sales = await Sale.find({
      customerId,
      ...dateFilter
    })
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
      .sort({ createdAt: -1 })
      .lean();

    // Calculate totals
    const totalBagsSold = sales.reduce((sum, sale) => sum + (sale.bagsSold || 0), 0);
    const totalAmount = sales.reduce((sum, sale) => {
      const amount = sale.totalAmount || (sale.bagsSold * (parseFloat(sale.ratePerBag) || 0));
      return sum + (parseFloat(amount) || 0);
    }, 0);

    // For demo: assuming 30% is paid, 70% is Baqaya (outstanding)
    const estimatedPaid = (parseFloat(totalAmount) || 0) * 0.3;
    const baqaya = (parseFloat(totalAmount) || 0) - estimatedPaid;

    return res.json({
      success: true,
      data: {
        customer: {
          id: customer._id,
          name: customer.name,
          contact: customer.contact,
          address: customer.address
        },
        summary: {
          totalSales: sales.length,
          totalBagsSold,
          totalAmount: parseFloat((totalAmount || 0).toFixed(2)),
          estimatedPaid: parseFloat((estimatedPaid || 0).toFixed(2)),
          baqaya: parseFloat((baqaya || 0).toFixed(2)),
        },
        transactions: sales.map(sale => ({
          id: sale._id,
          date: sale.createdAt,
          item: sale.laadItemId?.itemId?.name || 'Unknown',
          quality: sale.qualityGrade || sale.laadItemId?.qualityGrade || 'N/A',
          laadNumber: sale.laadItemId?.laadId?.laadNumber || sale.laadNumber || 'N/A',
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
    const supplier = await Supplier.findById(supplierId);

    if (!supplier) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found',
      });
    }

    // Build date filter
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.arrivalDate = {};
      if (startDate) dateFilter.arrivalDate.$gte = new Date(startDate);
      if (endDate) dateFilter.arrivalDate.$lte = new Date(endDate);
    }

    // Get all laads from this supplier
    const laads = await Laad.find({
      supplierId,
      ...dateFilter
    })
      .populate('vehicleId')
      .sort({ arrivalDate: -1 })
      .lean();

    // Get items for each laad
    const laadsWithItems = await Promise.all(
      laads.map(async (laad) => {
        const items = await LaadItem.find({ laadId: laad._id })
          .populate('itemId')
          .lean();
        return { ...laad, items };
      })
    );

    // Calculate totals
    const totalLaads = laadsWithItems.length;
    const totalBagsPurchased = laadsWithItems.reduce((sum, laad) => {
      return sum + (laad.items || []).reduce((itemSum, item) => itemSum + (item.totalBags || 0), 0);
    }, 0);

    const totalAmount = laadsWithItems.reduce((sum, laad) => {
      return sum + (laad.items || []).reduce((itemSum, item) => {
        const amount = parseFloat(item.totalAmount) || 0;
        return itemSum + amount;
      }, 0);
    }, 0);

    return res.json({
      success: true,
      data: {
        supplier: {
          id: supplier._id,
          name: supplier.name,
          contact: supplier.contact,
          address: supplier.address
        },
        summary: {
          totalLaads,
          totalBagsPurchased,
          totalAmount: parseFloat((totalAmount || 0).toFixed(2)),
        },
        transactions: laadsWithItems.map(laad => {
          const laadItems = Array.isArray(laad.items) ? laad.items : [];
          return {
            id: laad._id,
            laadNumber: laad.laadNumber,
            arrivalDate: laad.arrivalDate,
            vehicle: laad.vehicleId?.number || laad.vehicleNumber,
            itemsCount: laadItems.length,
            totalBags: laadItems.reduce((sum, item) => sum + (item.totalBags || 0), 0),
            totalAmount: laadItems.reduce((sum, item) => sum + (parseFloat(item.totalAmount) || 0), 0),
            items: laadItems.map(item => ({
              name: item.itemId?.name || 'Unknown',
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
    const sales = await Sale.find({
      createdAt: {
        $gte: startOfDay,
        $lte: endOfDay,
      },
    })
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
            model: 'Laad'
          }
        ]
      })
      .lean();

    // Calculate summary
    const totalSales = sales.length;
    const totalBagsSold = sales.reduce((sum, sale) => sum + (sale.bagsSold || 0), 0);
    const totalRevenue = sales.reduce((sum, sale) => {
      const amount = parseFloat(sale.totalAmount) || (sale.bagsSold * (parseFloat(sale.ratePerBag) || 0));
      return sum + amount;
    }, 0);

    // Group by customer
    const salesByCustomer = {};
    sales.forEach(sale => {
      const customerId = sale.customerId?._id?.toString() || 'unknown';
      if (!salesByCustomer[customerId]) {
        salesByCustomer[customerId] = {
          customer: sale.customerId?.name || 'Unknown',
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
          id: sale._id,
          time: sale.createdAt,
          customer: sale.customerId?.name || 'Unknown',
          item: sale.laadItemId?.itemId?.name || 'Unknown',
          quality: sale.qualityGrade || sale.laadItemId?.qualityGrade || 'N/A',
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
      laadFilter.arrivalDate = { $gte: new Date(startDate) };
      saleFilter.createdAt = { $gte: new Date(startDate) };
    }
    if (endDate) {
      if (laadFilter.arrivalDate) {
        laadFilter.arrivalDate.$lte = new Date(endDate);
      } else {
        laadFilter.arrivalDate = { $lte: new Date(endDate) };
      }
      if (saleFilter.createdAt) {
        saleFilter.createdAt.$lte = new Date(endDate);
      } else {
        saleFilter.createdAt = { $lte: new Date(endDate) };
      }
    }

    // Get incoming stock (laads)
    const laads = await Laad.find(laadFilter)
      .populate('supplierId')
      .sort({ arrivalDate: -1 })
      .lean();

    // Get laad items
    const laadsWithItems = await Promise.all(
      laads.map(async (laad) => {
        const itemFilter = { laadId: laad._id };
        if (itemId) itemFilter.itemId = itemId;
        
        const items = await LaadItem.find(itemFilter)
          .populate('itemId')
          .lean();
        return { ...laad, items };
      })
    );

    // Filter laads that have items (if itemId filter)
    const filteredLaads = itemId 
      ? laadsWithItems.filter(laad => laad.items && laad.items.length > 0)
      : laadsWithItems;

    // Get outgoing stock (sales)
    const saleItemFilter = {};
    if (itemId) {
      // Find sales where laadItem has this itemId
      const laadItems = await LaadItem.find({ itemId }).select('_id').lean();
      const laadItemIds = laadItems.map(li => li._id);
      saleFilter.laadItemId = { $in: laadItemIds };
    }

    const sales = await Sale.find(saleFilter)
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
            model: 'Laad'
          }
        ]
      })
      .sort({ createdAt: -1 })
      .lean();

    // Combine and sort by date
    const movements = [];

    filteredLaads.forEach(laad => {
      (laad.items || []).forEach(item => {
        if (!itemId || item.itemId?._id?.toString() === itemId) {
          movements.push({
            type: 'IN',
            date: laad.arrivalDate,
            reference: laad.laadNumber,
            laadNumber: laad.laadNumber,
            gatePassNumber: laad.gatePassNumber || 'N/A',
            party: laad.supplierId?.name || 'Unknown',
            item: item.itemId?.name || 'Unknown',
            quality: item.qualityGrade || item.itemId?.quality || 'N/A',
            bags: item.totalBags || 0,
            rate: parseFloat(item.ratePerBag) || 0,
            amount: parseFloat(item.totalAmount) || 0,
            truckNumber: laad.vehicleNumber || 'N/A',
            bagWeight: item.weightPerBag || null,
          });
        }
      });
    });

    sales.forEach(sale => {
      movements.push({
        type: 'OUT',
        date: sale.date || sale.createdAt,
        reference: `SALE-${sale._id}`,
        laadNumber: sale.laadNumber || sale.laadItemId?.laadId?.laadNumber || 'N/A',
        gatePassNumber: sale.gatePassNumber || sale.laadItemId?.laadId?.gatePassNumber || 'N/A',
        party: sale.customerId?.name || 'Unknown',
        item: sale.laadItemId?.itemId?.name || 'Unknown',
        quality: sale.qualityGrade || sale.laadItemId?.qualityGrade || sale.laadItemId?.itemId?.quality || 'N/A',
        bags: sale.bagsSold,
        rate: parseFloat(sale.ratePerBag) || 0,
        amount: parseFloat(sale.totalAmount) || (sale.bagsSold * (parseFloat(sale.ratePerBag) || 0)),
        truckNumber: sale.truckNumber || sale.laadItemId?.laadId?.vehicleNumber || 'N/A',
        bagWeight: sale.bagWeight || null,
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
    const customers = await Customer.find().lean();

    const ledgerData = await Promise.all(
      customers.map(async (customer) => {
        const sales = await Sale.find({ customerId: customer._id }).lean();

        const totalSales = sales.length;
        const totalBags = sales.reduce((sum, sale) => sum + (sale.bagsSold || 0), 0);
        const totalAmount = sales.reduce((sum, sale) => {
          const amount = parseFloat(sale.totalAmount) || (sale.bagsSold * (parseFloat(sale.ratePerBag) || 0));
          return sum + amount;
        }, 0);

        // Estimated Baqaya (70% of total)
        const baqaya = totalAmount * 0.7;

        return {
          id: customer._id,
          name: customer.name,
          contact: customer.contact,
          address: customer.address,
          totalSales,
          totalBags,
          totalAmount: parseFloat((totalAmount || 0).toFixed(2)),
          baqaya: parseFloat((baqaya || 0).toFixed(2)),
        };
      })
    );

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
    const suppliers = await Supplier.find().lean();

    const ledgerData = await Promise.all(
      suppliers.map(async (supplier) => {
        const laads = await Laad.find({ supplierId: supplier._id }).lean();

        const laadsWithItems = await Promise.all(
          laads.map(async (laad) => {
            const items = await LaadItem.find({ laadId: laad._id }).lean();
            return { ...laad, items };
          })
        );

        const totalLaads = laadsWithItems.length;
        const totalBags = laadsWithItems.reduce((sum, laad) => {
          return sum + (laad.items || []).reduce((itemSum, item) => itemSum + (item.totalBags || 0), 0);
        }, 0);
        const totalAmount = laadsWithItems.reduce((sum, laad) => {
          return sum + (laad.items || []).reduce((itemSum, item) => {
            return itemSum + (parseFloat(item.totalAmount) || 0);
          }, 0);
        }, 0);

        return {
          id: supplier._id,
          name: supplier.name,
          contact: supplier.contact,
          address: supplier.address,
          totalLaads,
          totalBags,
          totalAmount: parseFloat((totalAmount || 0).toFixed(2)),
        };
      })
    );

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

/**
 * Laad Report - Detailed report for a specific laad
 * Shows all items in the laad (incoming) and all sales from that laad (outgoing)
 */
exports.getLaadReport = async (req, res) => {
  try {
    const { laadNumber } = req.params;
    const { startDate, endDate } = req.query;

    // Find laad by laadNumber
    const laad = await Laad.findOne({ laadNumber })
      .populate('supplierId')
      .populate('vehicleId')
      .lean();

    if (!laad) {
      return res.status(404).json({
        success: false,
        message: `Laad with number ${laadNumber} not found`,
      });
    }

    // Build date filter for sales
    const saleDateFilter = {};
    if (startDate || endDate) {
      saleDateFilter.date = {};
      if (startDate) saleDateFilter.date.$gte = new Date(startDate);
      if (endDate) saleDateFilter.date.$lte = new Date(endDate);
    }

    // Get all items in this laad (incoming stock)
    const laadItems = await LaadItem.find({ laadId: laad._id })
      .populate('itemId')
      .sort({ createdAt: 1 })
      .lean();

    // Get all sales from items in this laad (outgoing stock)
    const laadItemIds = laadItems.map(item => item._id);
    const sales = await Sale.find({
      laadItemId: { $in: laadItemIds },
      ...saleDateFilter
    })
      .populate('customerId')
      .populate({
        path: 'laadItemId',
        populate: {
          path: 'itemId',
          model: 'Item'
        }
      })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    // Calculate outgoing summary first (needed for weight calculations)
    const outgoingSummary = {
      totalSales: sales.length,
      totalBagsSold: sales.reduce((sum, sale) => sum + (sale.bagsSold || 0), 0),
      totalRevenue: sales.reduce((sum, sale) => {
        const amount = parseFloat(sale.totalAmount) || (sale.bagsSold * (parseFloat(sale.ratePerBag) || 0));
        return sum + amount;
      }, 0),
      uniqueCustomers: new Set(sales.map(s => s.customerId?._id?.toString()).filter(Boolean)).size,
    };

    // Calculate weight tracking for each item
    const incomingItems = await Promise.all(laadItems.map(async (item) => {
      // Calculate total weight for this item
      const totalWeight = item.faisalabadWeight || item.weightFromJacobabad || 
        (item.weightPerBag && item.totalBags ? item.weightPerBag * item.totalBags : null);
      
      // Get all sales for this specific laadItem to calculate sold weight
      const itemSales = sales.filter(sale => 
        sale.laadItemId?._id?.toString() === item._id.toString()
      );
      
      // Calculate sold weight (sum of bagsSold * bagWeight from sales)
      const soldWeight = itemSales.reduce((sum, sale) => {
        const saleWeight = (sale.bagsSold || 0) * (parseFloat(sale.bagWeight) || 0);
        return sum + saleWeight;
      }, 0);
      
      // Calculate remaining weight
      const remainingWeight = totalWeight ? totalWeight - soldWeight : null;
      
      return {
        id: item.id || item._id.toString(),
        itemName: item.itemId?.name || 'Unknown',
        itemQuality: item.itemId?.quality || 'N/A',
        qualityGrade: item.qualityGrade || 'N/A',
        totalBags: item.totalBags || 0,
        remainingBags: item.remainingBags || 0,
        soldBags: (item.totalBags || 0) - (item.remainingBags || 0),
        weightPerBag: item.weightPerBag || null,
        weightFromJacobabad: item.weightFromJacobabad || null,
        faisalabadWeight: item.faisalabadWeight || null,
        totalWeight: totalWeight,
        soldWeight: soldWeight > 0 ? soldWeight : null,
        remainingWeight: remainingWeight,
        ratePerBag: parseFloat(item.ratePerBag) || 0,
        totalAmount: parseFloat(item.totalAmount) || 0,
      };
    }));

    // Calculate incoming summary with weight tracking
    const incomingSummary = {
      totalItems: incomingItems.length,
      totalBags: incomingItems.reduce((sum, item) => sum + (item.totalBags || 0), 0),
      totalAmount: incomingItems.reduce((sum, item) => sum + (item.totalAmount || 0), 0),
      totalWeight: incomingItems.reduce((sum, item) => sum + (item.totalWeight || 0), 0),
      soldWeight: incomingItems.reduce((sum, item) => sum + (item.soldWeight || 0), 0),
      remainingWeight: incomingItems.reduce((sum, item) => sum + (item.remainingWeight || 0), 0),
    };

    // Calculate outgoing summary
    const outgoingSales = sales.map(sale => ({
      id: sale._id.toString(),
      date: sale.date || sale.createdAt,
      customerName: sale.customerId?.name || 'Unknown',
      customerContact: sale.customerId?.contact || null,
      itemName: sale.laadItemId?.itemId?.name || 'Unknown',
      qualityGrade: sale.qualityGrade || sale.laadItemId?.qualityGrade || 'N/A',
      bagsSold: sale.bagsSold || 0,
      bagWeight: sale.bagWeight || null,
      ratePerBag: parseFloat(sale.ratePerBag) || 0,
      totalAmount: parseFloat(sale.totalAmount) || (sale.bagsSold * (parseFloat(sale.ratePerBag) || 0)),
      gatePassNumber: sale.gatePassNumber || null,
      truckNumber: sale.truckNumber || null,
      address: sale.address || null,
      brokerName: sale.brokerName || null,
      isMixOrder: sale.isMixOrder || false,
    }));

    return res.json({
      success: true,
      data: {
        laad: {
          laadNumber: laad.laadNumber,
          arrivalDate: laad.arrivalDate,
          supplierName: laad.supplierId?.name || 'Unknown',
          supplierContact: laad.supplierId?.contact || null,
          vehicleNumber: laad.vehicleNumber || laad.vehicleId?.number || null,
          vehicleType: laad.vehicleId?.type || null,
          gatePassNumber: laad.gatePassNumber || null,
          notes: laad.notes || null,
        },
        incoming: {
          summary: incomingSummary,
          items: incomingItems,
        },
        outgoing: {
          summary: outgoingSummary,
          sales: outgoingSales,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching laad report:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch laad report',
    });
  }
};

/**
 * Item Report - Detailed report for a specific item
 * Shows all laads where this item came in and all sales of this item
 */
exports.getItemReport = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { startDate, endDate } = req.query;

    // Find item
    let item;
    if (mongoose.Types.ObjectId.isValid(itemId) && itemId.length === 24) {
      item = await Item.findById(itemId).lean();
    } else {
      // Try numeric ID
      item = await Item.findOne({ id: parseInt(itemId) }).lean();
    }

    if (!item) {
      return res.status(404).json({
        success: false,
        message: `Item with ID ${itemId} not found`,
      });
    }

    // Build date filters
    const laadDateFilter = {};
    const saleDateFilter = {};
    
    if (startDate || endDate) {
      if (startDate) {
        laadDateFilter.arrivalDate = { $gte: new Date(startDate) };
        saleDateFilter.date = { $gte: new Date(startDate) };
      }
      if (endDate) {
        if (laadDateFilter.arrivalDate) {
          laadDateFilter.arrivalDate.$lte = new Date(endDate);
        } else {
          laadDateFilter.arrivalDate = { $lte: new Date(endDate) };
        }
        if (saleDateFilter.date) {
          saleDateFilter.date.$lte = new Date(endDate);
        } else {
          saleDateFilter.date = { $lte: new Date(endDate) };
        }
      }
    }

    // Get all laad items for this item
    const laadItems = await LaadItem.find({
      itemId: item._id
    })
      .populate({
        path: 'laadId',
        populate: {
          path: 'supplierId',
          model: 'Supplier'
        }
      })
      .lean();

    // Filter by date if provided
    let filteredLaadItems = laadItems.filter(li => li.laadId !== null);
    
    if (Object.keys(laadDateFilter).length > 0) {
      filteredLaadItems = filteredLaadItems.filter(li => {
        if (!li.laadId || !li.laadId.arrivalDate) return false;
        const arrivalDate = new Date(li.laadId.arrivalDate);
        if (laadDateFilter.arrivalDate.$gte && arrivalDate < laadDateFilter.arrivalDate.$gte) return false;
        if (laadDateFilter.arrivalDate.$lte && arrivalDate > laadDateFilter.arrivalDate.$lte) return false;
        return true;
      });
    }

    // Get all sales for this item
    const sales = await Sale.find({
      laadItemId: { $in: filteredLaadItems.map(li => li._id) },
      ...saleDateFilter
    })
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
            model: 'Laad'
          }
        ]
      })
      .sort({ date: -1, createdAt: -1 })
      .lean();

    // Calculate weight tracking for each laadItem
    const laadItemsWithWeight = await Promise.all(filteredLaadItems.map(async (laadItem) => {
      // Calculate total weight for this laadItem
      const totalWeight = laadItem.faisalabadWeight || laadItem.weightFromJacobabad || 
        (laadItem.weightPerBag && laadItem.totalBags ? laadItem.weightPerBag * laadItem.totalBags : null);
      
      // Get all sales for this specific laadItem to calculate sold weight
      const itemSales = sales.filter(sale => 
        sale.laadItemId?._id?.toString() === laadItem._id.toString()
      );
      
      // Calculate sold weight (sum of bagsSold * bagWeight from sales)
      const soldWeight = itemSales.reduce((sum, sale) => {
        const saleWeight = (sale.bagsSold || 0) * (parseFloat(sale.bagWeight) || 0);
        return sum + saleWeight;
      }, 0);
      
      // Calculate remaining weight
      const remainingWeight = totalWeight ? totalWeight - soldWeight : null;
      
      return {
        ...laadItem,
        totalWeight: totalWeight,
        soldWeight: soldWeight > 0 ? soldWeight : null,
        remainingWeight: remainingWeight,
      };
    }));

    // Calculate incoming summary (from laads) with weight tracking
    const incomingSummary = {
      totalLaads: new Set(laadItemsWithWeight.map(li => li.laadId?._id?.toString()).filter(Boolean)).size,
      totalBags: laadItemsWithWeight.reduce((sum, item) => sum + (item.totalBags || 0), 0),
      totalAmount: laadItemsWithWeight.reduce((sum, item) => sum + (parseFloat(item.totalAmount) || 0), 0),
      totalWeight: laadItemsWithWeight.reduce((sum, item) => sum + (item.totalWeight || 0), 0),
      soldWeight: laadItemsWithWeight.reduce((sum, item) => sum + (item.soldWeight || 0), 0),
      remainingWeight: laadItemsWithWeight.reduce((sum, item) => sum + (item.remainingWeight || 0), 0),
    };

    // Calculate outgoing summary (from sales)
    const outgoingSummary = {
      totalSales: sales.length,
      totalBagsSold: sales.reduce((sum, sale) => sum + (sale.bagsSold || 0), 0),
      totalRevenue: sales.reduce((sum, sale) => {
        const amount = parseFloat(sale.totalAmount) || (sale.bagsSold * (parseFloat(sale.ratePerBag) || 0));
        return sum + amount;
      }, 0),
      uniqueCustomers: new Set(sales.map(s => s.customerId?._id?.toString()).filter(Boolean)).size,
    };

    // Calculate current stock
    const currentStock = laadItemsWithWeight.reduce((sum, item) => sum + (item.remainingBags || 0), 0);

    // Get all TruckArrivalEntry records for this item to show ALL submissions (including duplicates)
    const truckArrivalDateFilter = {};
    if (startDate || endDate) {
      truckArrivalDateFilter.arrivalDate = {};
      if (startDate) truckArrivalDateFilter.arrivalDate.$gte = new Date(startDate);
      if (endDate) truckArrivalDateFilter.arrivalDate.$lte = new Date(endDate);
    }

    // Get all laad IDs that contain this item
    const laadIdsWithItem = filteredLaadItems.map(li => li.laadId?._id).filter(Boolean);
    
    // Get all TruckArrivalEntry records for these laads
    const truckArrivalEntries = await TruckArrivalEntry.find({
      laadId: { $in: laadIdsWithItem },
      ...truckArrivalDateFilter
    })
      .populate('supplierId', 'name contact')
      .populate('laadId', 'laadNumber arrivalDate vehicleNumber')
      .populate('items.itemId', 'name quality') // Populate itemId in items array
      .sort({ arrivalDate: -1, createdAt: -1 })
      .lean();

    // Format incoming records - Include both LaadItems (actual stock) and TruckArrivalEntry items (all submissions)
    const incomingRecords = [];
    const truckArrivalRecordMap = new Map(); // To track which truck arrival entries we've processed

    // Create a map of LaadItem IDs to track which items are already in stock
    const laadItemMap = new Map();
    laadItemsWithWeight.forEach((laadItem) => {
      const key = `${laadItem.laadId?._id?.toString() || ''}-${laadItem.qualityGrade || ''}`;
      laadItemMap.set(key, laadItem);
    });

    // First, add only TruckArrivalEntry items that are DUPLICATE_SKIPPED (these don't have LaadItems)
    // For ADDED items, we'll show the LaadItem instead to avoid duplicates
    truckArrivalEntries.forEach((entry) => {
      if (!entry.items || entry.items.length === 0) return;
      
      entry.items.forEach((entryItem) => {
        // Check if this item matches our target item
        let entryItemId;
        if (entryItem.itemId) {
          // Handle both ObjectId and string formats
          if (typeof entryItem.itemId === 'object' && entryItem.itemId._id) {
            entryItemId = entryItem.itemId._id.toString();
          } else if (typeof entryItem.itemId === 'object' && entryItem.itemId.toString) {
            entryItemId = entryItem.itemId.toString();
          } else {
            entryItemId = entryItem.itemId.toString ? entryItem.itemId.toString() : String(entryItem.itemId);
          }
        } else {
          return; // Skip if no itemId
        }
        const targetItemId = item._id.toString();
        if (entryItemId !== targetItemId) return;

        // Only show TruckArrivalEntry items that are DUPLICATE_SKIPPED
        // For ADDED items, the LaadItem will be shown instead
        if (entryItem.status !== 'DUPLICATE_SKIPPED') {
          return; // Skip ADDED items - they'll be shown as LaadItems
        }

        const uniqueKey = `${entry._id.toString()}-${entryItem.itemId?.toString() || ''}-${entryItem.qualityGrade || ''}`;
        if (truckArrivalRecordMap.has(uniqueKey)) return; // Skip if already added
        truckArrivalRecordMap.set(uniqueKey, true);

        // Calculate weight for this entry item
        const entryTotalWeight = entryItem.faisalabadWeight || entryItem.weightFromJacobabad || 
          (entryItem.weightPerBag && entryItem.totalBags ? entryItem.weightPerBag * entryItem.totalBags : null);

        incomingRecords.push({
          laadNumber: entry.laadNumber || entry.laadId?.laadNumber || 'N/A',
          arrivalDate: entry.arrivalDate || entry.laadId?.arrivalDate || null,
          supplierName: entry.supplierId?.name || entry.supplier?.name || 'Unknown',
          vehicleNumber: entry.laadId?.vehicleNumber || null,
          gatePassNumber: entry.gatePassNumber || null,
          isTruckArrivalEntry: true, // Flag to identify truck arrival entries
          entryStatus: entryItem.status || 'DUPLICATE_SKIPPED', // Status from truck arrival entry
          items: [{
            id: `truck-entry-${entry._id.toString()}-${entryItem.itemId?.toString() || ''}`,
            qualityGrade: entryItem.qualityGrade || 'N/A',
            totalBags: entryItem.totalBags || 0,
            remainingBags: 0, // Duplicates don't add to stock
            soldBags: 0, // Duplicates can't be sold
            weightPerBag: entryItem.weightPerBag || null,
            weightFromJacobabad: entryItem.weightFromJacobabad || null,
            faisalabadWeight: entryItem.faisalabadWeight || null,
            totalWeight: entryTotalWeight,
            soldWeight: null, // Duplicates can't be sold
            remainingWeight: 0, // Duplicates don't add to stock
            ratePerBag: parseFloat(entryItem.ratePerBag) || 0,
            totalAmount: parseFloat(entryItem.totalAmount) || 0,
          }],
        });
      });
    });

    // Then add LaadItems (actual stock records) - these are the ones that were actually added to stock
    laadItemsWithWeight.forEach((laadItem, index) => {
      const laadId = laadItem.laadId?._id?.toString();
      if (!laadId) return;

      // Create a separate record for each LaadItem to show all entries
      incomingRecords.push({
        laadNumber: laadItem.laadId?.laadNumber || 'N/A',
        arrivalDate: laadItem.laadId?.arrivalDate || null,
        supplierName: laadItem.laadId?.supplierId?.name || 'Unknown',
        vehicleNumber: laadItem.laadId?.vehicleNumber || null,
        gatePassNumber: laadItem.laadId?.gatePassNumber || null,
        isTruckArrivalEntry: false, // This is actual stock
        entryStatus: 'ADDED',
        items: [{
          id: laadItem.id || laadItem._id.toString() || `item-${index}`,
          qualityGrade: laadItem.qualityGrade || 'N/A',
          totalBags: laadItem.totalBags || 0,
          remainingBags: laadItem.remainingBags || 0,
          soldBags: (laadItem.totalBags || 0) - (laadItem.remainingBags || 0),
          weightPerBag: laadItem.weightPerBag || null,
          weightFromJacobabad: laadItem.weightFromJacobabad || null,
          faisalabadWeight: laadItem.faisalabadWeight || null,
          totalWeight: laadItem.totalWeight || null,
          soldWeight: laadItem.soldWeight || null,
          remainingWeight: laadItem.remainingWeight || null,
          ratePerBag: parseFloat(laadItem.ratePerBag) || 0,
          totalAmount: parseFloat(laadItem.totalAmount) || 0,
        }],
      });
    });

    // Format outgoing sales
    const outgoingSales = sales.map(sale => ({
      id: sale._id.toString(),
      date: sale.date || sale.createdAt,
      customerName: sale.customerId?.name || 'Unknown',
      customerContact: sale.customerId?.contact || null,
      laadNumber: sale.laadNumber || sale.laadItemId?.laadId?.laadNumber || 'N/A',
      qualityGrade: sale.qualityGrade || sale.laadItemId?.qualityGrade || 'N/A',
      bagsSold: sale.bagsSold || 0,
      bagWeight: sale.bagWeight || null,
      ratePerBag: parseFloat(sale.ratePerBag) || 0,
      totalAmount: parseFloat(sale.totalAmount) || (sale.bagsSold * (parseFloat(sale.ratePerBag) || 0)),
      gatePassNumber: sale.gatePassNumber || null,
      truckNumber: sale.truckNumber || null,
      address: sale.address || null,
      brokerName: sale.brokerName || null,
      isMixOrder: sale.isMixOrder || false,
    }));

    return res.json({
      success: true,
      data: {
        item: {
          id: item.id || item._id.toString(),
          name: item.name,
          quality: item.quality,
        },
        summary: {
          currentStock,
          ...incomingSummary,
          ...outgoingSummary,
        },
        incoming: {
          summary: incomingSummary,
          records: incomingRecords,
        },
        outgoing: {
          summary: outgoingSummary,
          sales: outgoingSales,
        },
      },
    });
  } catch (error) {
    console.error('Error fetching item report:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch item report',
    });
  }
};
