const prisma = require('../config/prisma');

exports.createItem = async (payload) => {
  // expecting { name, quality, bagWeight }
  return prisma.item.create({ data: payload });
};

exports.getItems = async () => {
  return prisma.item.findMany({ orderBy: { name: 'asc' } });
};

exports.getItemStockSummary = async () => {
  const stockRows = await prisma.laadItem.groupBy({
    by: ['itemId'],
    _sum: {
      totalBags: true,
      remainingBags: true,
    },
  });

  if (stockRows.length === 0) return [];

  const itemIds = stockRows.map((row) => row.itemId);
  const items = await prisma.item.findMany({
    where: { id: { in: itemIds } },
  });

  const itemMap = items.reduce((acc, item) => {
    acc[item.id] = item;
    return acc;
  }, {});

  return stockRows.map((row) => {
    const item = itemMap[row.itemId] || {};
    const totalBags = row._sum.totalBags || 0;
    const remainingBags = row._sum.remainingBags || 0;

    return {
      itemId: row.itemId,
      itemName: item.name || 'Unknown Item',
      quality: item.quality || null,
      bagWeight: item.bagWeight || null,
      totalBags,
      remainingBags,
      soldBags: totalBags - remainingBags,
    };
  });
};