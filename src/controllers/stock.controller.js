const stockService = require('../services/stock.service');

/**
 * Get combined stock items for sale
 * Combines items with same itemName + qualityGrade + laadId
 */
exports.getCombinedStockItems = async (req, res, next) => {
  try {
    const stockItems = await stockService.getCombinedStockItems();
    res.json({ success: true, data: stockItems });
  } catch (err) {
    next(err);
  }
};

