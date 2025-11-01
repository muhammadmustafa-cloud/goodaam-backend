const prisma = require('../config/prisma');

// Get financial balances for customers and suppliers
exports.getFinancialBalances = async (req, res, next) => {
  try {
    const { type, customerId, supplierId } = req.query;

    const where = {};
    if (type === 'customer') {
      where.customerId = customerId ? parseInt(customerId) : undefined;
      where.supplierId = null;
    } else if (type === 'supplier') {
      where.supplierId = supplierId ? parseInt(supplierId) : undefined;
      where.customerId = null;
    }

    const balances = await prisma.financialBalance.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            contact: true
          }
        },
        supplier: {
          select: {
            id: true,
            name: true,
            contact: true
          }
        }
      },
      orderBy: { lastUpdated: 'desc' }
    });

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

    const validTransactionTypes = ['CREDIT', 'DEBIT'];
    if (!validTransactionTypes.includes(transactionType)) {
      return res.status(400).json({
        success: false,
        message: 'transactionType must be CREDIT or DEBIT'
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Find existing balance or create new one
      let balance = await tx.financialBalance.findFirst({
        where: {
          customerId: customerId || null,
          supplierId: supplierId || null
        }
      });

      if (!balance) {
        // Create new balance record
        balance = await tx.financialBalance.create({
          data: {
            customerId: customerId || null,
            supplierId: supplierId || null,
            balance: 0
          }
        });
      }

      // Update balance based on transaction type
      const amountChange = transactionType === 'CREDIT' ? parseFloat(amount) : -parseFloat(amount);
      const newBalance = parseFloat(balance.balance) + amountChange;

      const updatedBalance = await tx.financialBalance.update({
        where: { id: balance.id },
        data: {
          balance: newBalance,
          lastUpdated: new Date()
        },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              contact: true
            }
          },
          supplier: {
            select: {
              id: true,
              name: true,
              contact: true
            }
          }
        }
      });

      return updatedBalance;
    });

    res.json({ 
      success: true, 
      data: result,
      message: 'Financial balance updated successfully'
    });
  } catch (err) { next(err); }
};

// Get balance summary
exports.getBalanceSummary = async (req, res, next) => {
  try {
    const [customerBalances, supplierBalances] = await Promise.all([
      prisma.financialBalance.findMany({
        where: { customerId: { not: null } },
        include: {
          customer: {
            select: {
              id: true,
              name: true,
              contact: true
            }
          }
        }
      }),
      prisma.financialBalance.findMany({
        where: { supplierId: { not: null } },
        include: {
          supplier: {
            select: {
              id: true,
              name: true,
              contact: true
            }
          }
        }
      })
    ]);

    const totalCustomerBalance = customerBalances.reduce((sum, balance) => 
      sum + parseFloat(balance.balance), 0
    );
    
    const totalSupplierBalance = supplierBalances.reduce((sum, balance) => 
      sum + parseFloat(balance.balance), 0
    );

    const netBalance = totalCustomerBalance - totalSupplierBalance;

    res.json({
      success: true,
      data: {
        customerBalances,
        supplierBalances,
        summary: {
          totalCustomerBalance,
          totalSupplierBalance,
          netBalance,
          customerCount: customerBalances.length,
          supplierCount: supplierBalances.length
        }
      }
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

    const balance = await prisma.financialBalance.findFirst({
      where: {
        customerId: customerId ? parseInt(customerId) : null,
        supplierId: supplierId ? parseInt(supplierId) : null
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            contact: true
          }
        },
        supplier: {
          select: {
            id: true,
            name: true,
            contact: true
          }
        }
      }
    });

    if (!balance) {
      return res.status(404).json({
        success: false,
        message: 'Balance record not found'
      });
    }

    res.json({ success: true, data: balance });
  } catch (err) { next(err); }
};
