const FinancialBalance = require('../models/FinancialBalance');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');

exports.getFinancialBalances = async (filters = {}) => {
  const { type, customerId, supplierId } = filters;

  const query = {};
  if (type === 'customer') {
    query.customerId = customerId || { $ne: null };
    query.supplierId = null;
  } else if (type === 'supplier') {
    query.supplierId = supplierId || { $ne: null };
    query.customerId = null;
  }

  return await FinancialBalance.find(query)
    .populate('customerId', 'name contact')
    .populate('supplierId', 'name contact')
    .sort({ lastUpdated: -1 })
    .lean();
};

exports.updateFinancialBalance = async (payload) => {
  const { customerId, supplierId, amount, transactionType } = payload;

  const validTransactionTypes = ['CREDIT', 'DEBIT'];
  if (!validTransactionTypes.includes(transactionType)) {
    const e = new Error('transactionType must be CREDIT or DEBIT');
    e.status = 400;
    throw e;
  }

  // MongoDB session for transaction
  const session = await FinancialBalance.startSession();
  session.startTransaction();

  try {
    // Find existing balance or create new one
    let balance = await FinancialBalance.findOne({
      customerId: customerId || null,
      supplierId: supplierId || null
    }).session(session);

    if (!balance) {
      balance = new FinancialBalance({
        customerId: customerId || null,
        supplierId: supplierId || null,
        balance: 0
      });
      await balance.save({ session });
    }

    // Update balance based on transaction type
    const amountChange = transactionType === 'CREDIT' 
      ? parseFloat(amount) 
      : -parseFloat(amount);
    const newBalance = parseFloat(balance.balance) + amountChange;

    balance.balance = newBalance;
    balance.lastUpdated = new Date();
    await balance.save({ session });

    await session.commitTransaction();

    // Populate and return
    const populated = await FinancialBalance.findById(balance._id)
      .populate('customerId', 'name contact')
      .populate('supplierId', 'name contact')
      .lean();

    return populated;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
};

exports.getBalanceSummary = async () => {
  const [customerBalances, supplierBalances] = await Promise.all([
    FinancialBalance.find({ customerId: { $ne: null } })
      .populate('customerId', 'name contact')
      .lean(),
    FinancialBalance.find({ supplierId: { $ne: null } })
      .populate('supplierId', 'name contact')
      .lean()
  ]);

  const totalCustomerBalance = customerBalances.reduce(
    (sum, balance) => sum + parseFloat(balance.balance || 0), 
    0
  );
  
  const totalSupplierBalance = supplierBalances.reduce(
    (sum, balance) => sum + parseFloat(balance.balance || 0), 
    0
  );

  const netBalance = totalCustomerBalance - totalSupplierBalance;

  return {
    customerBalances,
    supplierBalances,
    summary: {
      totalCustomerBalance,
      totalSupplierBalance,
      netBalance,
      customerCount: customerBalances.length,
      supplierCount: supplierBalances.length
    }
  };
};

exports.getBalanceHistory = async (filters = {}) => {
  const { customerId, supplierId } = filters;

  const balance = await FinancialBalance.findOne({
    customerId: customerId || null,
    supplierId: supplierId || null
  })
    .populate('customerId', 'name contact')
    .populate('supplierId', 'name contact')
    .lean();

  if (!balance) {
    const e = new Error('Balance record not found');
    e.status = 404;
    throw e;
  }

  return balance;
};

