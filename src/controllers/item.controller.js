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

exports.updateItem = async (req, res, next) => {
  try {
    const item = await svc.updateItem(req.params.id, req.body);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
};

exports.deleteItem = async (req, res, next) => {
  try {
    const item = await svc.deleteItem(req.params.id);
    if (!item) {
      return res.status(404).json({
        success: false,
        message: 'Item not found'
      });
    }
    res.json({ success: true, data: item });
  } catch (err) { next(err); }
};