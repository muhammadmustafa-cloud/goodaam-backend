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
    const rows = await svc.getSales();
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.getMixOrders = async (req, res, next) => {
  try {
    const mixOrders = await svc.getMixOrders();
    res.json({ success: true, data: mixOrders });
  } catch (err) { next(err); }
};
