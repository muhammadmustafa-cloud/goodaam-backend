const prisma = require('../config/prisma');

exports.createCustomer = async (payload) => {
  return prisma.customer.create({ data: payload });
};

exports.getCustomers = async () => {
  return prisma.customer.findMany({ orderBy: { createdAt: 'desc' } });
};

exports.getCustomerById = async (id) => {
  return prisma.customer.findUnique({ where: { id } });
};

exports.updateCustomer = async (id, payload) => {
  return prisma.customer.update({ where: { id }, data: payload });
};

exports.deleteCustomer = async (id) => {
  return prisma.customer.delete({ where: { id } });
};