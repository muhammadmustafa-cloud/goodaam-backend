const service = require('../services/customer.service');

exports.createCustomer = async (req, res, next) => {
  try {
    const data = await service.createCustomer(req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.getCustomers = async (req, res, next) => {
  try {
    const rows = await service.getCustomers();
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.getCustomerById = async (req, res, next) => {
  try {
    const row = await service.getCustomerById(+req.params.id);
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    const row = await service.updateCustomer(+req.params.id, req.body);
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    await service.deleteCustomer(+req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
};