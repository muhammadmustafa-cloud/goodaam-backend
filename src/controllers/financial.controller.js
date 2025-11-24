const service = require('../services/financial.service');

// Get financial balances for customers and suppliers
exports.getFinancialBalances = async (req, res, next) => {
  try {
    const { type, customerId, supplierId } = req.query;

    const filters = { type, customerId, supplierId };
    const balances = await service.getFinancialBalances(filters);

    res.json({ success: true, data: balances });
  } catch (err) { next(err); }
};

// Update financial balance
exports.updateFinancialBalance = async (req, res, next) => {
  try {
    const { customerId, supplierId, amount, transactionType, description } = req.body;

    if (!customerId && !supplierId) {
      return res.status(400).json({
        success: false,
        message: 'Either customerId or supplierId is required'
      });
    }

    if (!amount || !transactionType) {
      return res.status(400).json({
        success: false,
        message: 'amount and transactionType are required'
      });
    }

    const result = await service.updateFinancialBalance({
      customerId,
      supplierId,
      amount,
      transactionType
    });

    res.json({ 
      success: true, 
      data: result,
      message: 'Financial balance updated successfully'
    });
  } catch (err) { 
    if (err.status === 400) {
      return res.status(400).json({
        success: false,
        message: err.message
      });
    }
    next(err); 
  }
};

// Get balance summary
exports.getBalanceSummary = async (req, res, next) => {
  try {
    const summary = await service.getBalanceSummary();

    res.json({
      success: true,
      data: summary
    });
  } catch (err) { next(err); }
};

// Get balance history for a specific customer/supplier
exports.getBalanceHistory = async (req, res, next) => {
  try {
    const { customerId, supplierId } = req.query;

    if (!customerId && !supplierId) {
      return res.status(400).json({
        success: false,
        message: 'Either customerId or supplierId is required'
      });
    }

    const balance = await service.getBalanceHistory({
      customerId,
      supplierId
    });

    res.json({ success: true, data: balance });
  } catch (err) { 
    if (err.status === 404) {
      return res.status(404).json({
        success: false,
        message: err.message
      });
    }
    next(err); 
  }
};
