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
    const row = await service.getSupplierById(req.params.id);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

exports.updateSupplier = async (req, res, next) => {
  try {
    // Get ID from params or body (fallback for frontend compatibility)
    let supplierId = req.params.id;
    
    // If ID is undefined in params, try to get from body
    if (!supplierId || supplierId === 'undefined' || supplierId === 'null') {
      supplierId = req.body.id || req.body._id;
      
      if (!supplierId) {
        return res.status(400).json({
          success: false,
          message: 'Supplier ID is required. Please provide ID in URL path or request body.'
        });
      }
    }

    // Remove ID from body to avoid updating it
    const { id, _id, ...updateData } = req.body;

    const row = await service.updateSupplier(supplierId, updateData);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

exports.deleteSupplier = async (req, res, next) => {
  try {
    const result = await service.deleteSupplier(req.params.id);
    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Supplier not found'
      });
    }
    res.json({ success: true, message: 'Supplier deleted successfully' });
  } catch (err) { next(err); }
};
