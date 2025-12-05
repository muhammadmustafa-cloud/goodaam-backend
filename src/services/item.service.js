const Item = require('../models/Item');
const LaadItem = require('../models/LaadItem');

exports.createItem = async (payload) => {
  // expecting { name, quality }
  const item = new Item(payload);
  return await item.save();
};

exports.getItems = async () => {
  return await Item.find().sort({ id: 1 });
};

exports.getItemStockSummary = async () => {
  // MongoDB aggregation to group by itemId
  const stockRows = await LaadItem.aggregate([
    {
      $group: {
        _id: '$itemId',
        totalBags: { $sum: '$totalBags' },
        remainingBags: { $sum: '$remainingBags' }
      }
    }
  ]);

  if (stockRows.length === 0) return [];

  const itemIds = stockRows.map((row) => row._id);
  const items = await Item.find({ _id: { $in: itemIds } });

  const itemMap = items.reduce((acc, item) => {
    acc[item._id.toString()] = item;
    return acc;
  }, {});

  return stockRows.map((row) => {
    const item = itemMap[row._id.toString()] || {};
    const totalBags = row.totalBags || 0;
    const remainingBags = row.remainingBags || 0;

    return {
      itemId: row._id,
      itemName: item.name || 'Unknown Item',
      quality: item.quality || null,
      totalBags,
      remainingBags,
      soldBags: totalBags - remainingBags,
    };
  });
};