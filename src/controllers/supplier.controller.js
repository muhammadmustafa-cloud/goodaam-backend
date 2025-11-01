const service = require('../services/supplier.service');

exports.createSupplier = async (req, res, next) => {
  try {
    const data = await service.createSupplier(req.body);
    res.json({ success: true, data });
  } catch (err) { next(err); }
};

exports.getSuppliers = async (req, res, next) => {
  try {
    const rows = await service.getSuppliers();
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.getSupplierById = async (req, res, next) => {
  try {
    const row = await service.getSupplierById(+req.params.id);
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

exports.updateSupplier = async (req, res, next) => {
  try {
    const row = await service.updateSupplier(+req.params.id, req.body);
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

exports.deleteSupplier = async (req, res, next) => {
  try {
    await service.deleteSupplier(+req.params.id);
    res.json({ success: true });
  } catch (err) { next(err); }
};
