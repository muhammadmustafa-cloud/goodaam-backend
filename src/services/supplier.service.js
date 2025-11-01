const prisma = require('../config/prisma');

exports.createSupplier = async (payload) => {
  return prisma.supplier.create({ data: payload });
};

exports.getSuppliers = async () => {
  return prisma.supplier.findMany({ orderBy: { createdAt: 'desc' } });
};

exports.getSupplierById = async (id) => {
  return prisma.supplier.findUnique({ where: { id } });
};

exports.updateSupplier = async (id, payload) => {
  return prisma.supplier.update({ where: { id }, data: payload });
};

exports.deleteSupplier = async (id) => {
  return prisma.supplier.delete({ where: { id } });
};
