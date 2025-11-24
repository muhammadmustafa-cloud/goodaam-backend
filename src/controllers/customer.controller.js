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
    const row = await service.getCustomerById(req.params.id);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

exports.updateCustomer = async (req, res, next) => {
  try {
    const row = await service.updateCustomer(req.params.id, req.body);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

exports.deleteCustomer = async (req, res, next) => {
  try {
    const result = await service.deleteCustomer(req.params.id);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    res.json({ success: true, message: 'Customer deleted successfully' });
  } catch (err) { next(err); }
};