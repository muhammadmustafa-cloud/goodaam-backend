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
  // MongoDB aggregation to group by itemId + qualityGrade
  // This ensures items with same name but different quality grades are tracked separately
  // Also calculates remaining weights based on remaining bags ratio
  const stockRows = await LaadItem.aggregate([
    {
      $group: {
        _id: {
          itemId: '$itemId',
          qualityGrade: '$qualityGrade'
        },
        totalBags: { $sum: '$totalBags' },
        remainingBags: { $sum: '$remainingBags' },
        // Store arrays of weights and bags for calculating remaining weights
        weightData: {
          $push: {
            totalBags: '$totalBags',
            remainingBags: '$remainingBags',
            faisalabadWeight: '$faisalabadWeight',
            jcdWeight: '$weightFromJacobabad'
          }
        }
      }
    }
  ]);

  if (stockRows.length === 0) return [];

  // Extract unique itemIds and fetch items
  const itemIds = [...new Set(stockRows.map((row) => row._id.itemId))];
  const items = await Item.find({ _id: { $in: itemIds } });

  const itemMap = items.reduce((acc, item) => {
    acc[item._id.toString()] = item;
    return acc;
  }, {});

  const result = stockRows.map((row) => {
    const item = itemMap[row._id.itemId.toString()] || {};
    const totalBags = row.totalBags || 0;
    const remainingBags = row.remainingBags || 0;
    const qualityGrade = row._id.qualityGrade || null;

    // Calculate remaining weights based on remaining bags ratio for each LaadItem
    let remainingFaisalabadWeight = 0;
    let remainingJcdWeight = 0;

    row.weightData.forEach((wd) => {
      if (wd.totalBags > 0) {
        // Calculate ratio of remaining bags to total bags
        const ratio = (wd.remainingBags || 0) / wd.totalBags;
        
        // Apply ratio to weights
        if (wd.faisalabadWeight) {
          remainingFaisalabadWeight += wd.faisalabadWeight * ratio;
        }
        if (wd.jcdWeight) {
          remainingJcdWeight += wd.jcdWeight * ratio;
        }
      }
    });

    return {
      itemId: item.id || row._id.itemId.toString(), // Use numeric id if available, otherwise ObjectId string
      itemName: item.name || 'Unknown Item',
      quality: qualityGrade, // Use qualityGrade from LaadItem, not Item.quality
      totalBags,
      remainingBags,
      soldBags: totalBags - remainingBags,
      remainingFaisalabadWeight: Math.round(remainingFaisalabadWeight * 100) / 100, // Round to 2 decimal places
      remainingJcdWeight: Math.round(remainingJcdWeight * 100) / 100, // Round to 2 decimal places
    };
  });

  // Sort by item name, then by quality grade for consistent ordering
  return result.sort((a, b) => {
    const nameCompare = (a.itemName || '').localeCompare(b.itemName || '');
    if (nameCompare !== 0) return nameCompare;
    return (a.quality || '').localeCompare(b.quality || '');
  });
};