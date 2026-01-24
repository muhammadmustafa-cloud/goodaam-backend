const svc = require('../services/sale.service');

exports.createSale = async (req, res, next) => {
  try {
    const sale = await svc.createSale(req.body);
    res.json({ success: true, data: sale });
  } catch (err) { next(err); }
};

exports.createMixOrder = async (req, res, next) => {
  try {
    const mixOrder = await svc.createMixOrder(req.body);
    res.json({ success: true, data: mixOrder });
  } catch (err) { next(err); }
};

exports.getSales = async (req, res, next) => {
  try {
    const filters = {
      dateFrom: req.query.dateFrom,
      dateTo: req.query.dateTo,
      customerId: req.query.customerId,
      laadNumber: req.query.laadNumber
    };
    const rows = await svc.getSales(filters);
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.getSaleById = async (req, res, next) => {
  try {
    const sale = await svc.getSaleById(req.params.id);
    if (!sale) {
      return res.status(404).json({
        success: false,
        message: 'Sale not found'
      });
    }
    res.json({ success: true, data: sale });
  } catch (err) { next(err); }
};

exports.updateSale = async (req, res, next) => {
  try {
    const sale = await svc.updateSale(req.params.id, req.body);
    res.json({ success: true, data: sale });
  } catch (err) { next(err); }
};

exports.getMixOrders = async (req, res, next) => {
  try {
    const mixOrders = await svc.getMixOrders();
    res.json({ success: true, data: mixOrders });
  } catch (err) { next(err); }
};

exports.getSalesAnalytics = async (req, res, next) => {
  try {
    const filters = {
      category: req.query.category,
      dateRange: req.query.dateRange
    };
    const analytics = await svc.getSalesAnalytics(filters);
    res.json({ success: true, data: analytics });
  } catch (err) { next(err); }
};
