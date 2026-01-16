const mongoose = require('mongoose');

const saleItemSchema = new mongoose.Schema(
  {
    laadItemId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'LaadItem',
      required: true,
      index: true,
    },
    bagsSold: {
      type: Number,
      required: true,
      min: 1,
    },
    bagWeight: {
      type: Number,
      required: true,
      min: 0.1,
    },
    totalKantaWeight: {
      type: Number,
      default: 0,
      min: 0,
    },
    ratePerBag: {
      type: Number,
    },
    totalAmount: {
      type: Number,
    },
    qualityGrade: {
      type: String,
      trim: true,
    },
    laadNumber: {
      type: String,
      trim: true,
    },
  },
  { _id: false }
);

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
  // New unified shape: sale can contain multiple items
  items: {
    type: [saleItemSchema],
    default: undefined,
  },
  laadItemId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LaadItem',
    required: function () {
      return !Array.isArray(this.items) || this.items.length === 0;
    },
    index: true
  },
  bagsSold: {
    type: Number,
    required: function () {
      return !Array.isArray(this.items) || this.items.length === 0;
    }
  },
  bagWeight: {
    type: Number,
    required: function () {
      return !Array.isArray(this.items) || this.items.length === 0;
    },
    min: 0.1,
    comment: 'Weight per bag sold to customer (can differ from stock bag weight)'
  },
  totalBags: {
    type: Number,
    index: true,
  },
  totalWeight: {
    type: Number,
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
  },
  gatePassNumber: {
    type: String,
    trim: true,
    index: true,
    comment: 'Gate pass number for sale tracking'
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
saleSchema.index({ gatePassNumber: 1 });

module.exports = mongoose.model('Sale', saleSchema);

