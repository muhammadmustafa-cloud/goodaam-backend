const prisma = require('../config/prisma');

exports.createItem = async (payload) => {
  // expecting { name, quality, bagWeight }
  return prisma.item.create({ data: payload });
};

exports.getItems = async () => {
  return prisma.item.findMany({ orderBy: { name: 'asc' } });
};
