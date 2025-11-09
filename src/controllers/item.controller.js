const svc = require('../services/item.service');

exports.createItem = async (req, res, next) => {
  try {
    const item = await svc.createItem(req.body);
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
};

exports.getItems = async (req, res, next) => {
  try {
    const items = await svc.getItems();
    res.json({ success: true, data: items });
  } catch (err) { next(err); }
};

exports.getItemStockSummary = async (req, res, next) => {
  try {
    const summary = await svc.getItemStockSummary();
    res.json({ success: true, data: summary });
  } catch (err) { next(err); }
};