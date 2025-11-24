const mongoose = require('mongoose');

const financialBalanceSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    index: true
  },
  supplierId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Supplier',
    index: true
  },
  balance: {
    type: Number,
    default: 0,
    required: true
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Unique constraint: one balance per customer/supplier combination
financialBalanceSchema.index({ customerId: 1, supplierId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('FinancialBalance', financialBalanceSchema);

