const svc = require('../services/laad.service');

exports.createLaad = async (req, res, next) => {
  try {
    const laad = await svc.createLaadWithItems(req.body);
    res.json({ success: true, data: laad });
  } catch (err) { next(err); }
};

exports.getLaads = async (req, res, next) => {
  try {
    const rows = await svc.getLaads();
    res.json({ success: true, data: rows });
  } catch (err) { next(err); }
};

exports.getLaadById = async (req, res, next) => {
  try {
    const row = await svc.getLaadById(req.params.id);
    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Laad not found'
      });
    }
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};

exports.updateLaad = async (req, res, next) => {
  try {
    const laad = await svc.updateLaadWithItems(req.params.id, req.body);
    res.json({ success: true, data: laad });
  } catch (err) { next(err); }
};