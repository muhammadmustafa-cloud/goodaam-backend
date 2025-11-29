const mongoose = require('mongoose');

const saleSchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now,
    index: true
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  laadItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LaadItem',
    required: true,
    index: true
  },
  bagsSold: {
    type: Number,
    required: true
  },
  bagWeight: {
    type: Number,
    required: true,
    min: 0.1,
    comment: 'Weight per bag sold to customer (can differ from stock bag weight)'
  },
  ratePerBag: {
    type: Number
  },
  totalAmount: {
    type: Number
  },
  isMixOrder: {
    type: Boolean,
    default: false
  },
  mixOrderDetails: {
    type: mongoose.Schema.Types.Mixed // JSON data
  },
  qualityGrade: {
    type: String,
    trim: true
  },
  laadNumber: {
    type: String,
    index: true
  },
  truckNumber: {
    type: String,
    index: true
  },
  address: {
    type: String,
    trim: true
  },
  brokerName: {
    type: String,
    trim: true,
    index: true
  }
}, {
  timestamps: true
});

// Indexes for faster queries
saleSchema.index({ customerId: 1 });
saleSchema.index({ laadItemId: 1 });
saleSchema.index({ createdAt: -1 });
saleSchema.index({ date: -1 });
saleSchema.index({ laadNumber: 1 });
saleSchema.index({ truckNumber: 1 });

module.exports = mongoose.model('Sale', saleSchema);

