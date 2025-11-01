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
    const row = await svc.getLaadById(+req.params.id);
    res.json({ success: true, data: row });
  } catch (err) { next(err); }
};
